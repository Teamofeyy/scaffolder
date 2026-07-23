import { createServer } from 'node:net'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const recipesRoot = path.join(repoRoot, 'recipes', 'catalog')
const defaultReportDir = path.join(repoRoot, 'artifacts', 'recipe-verification')
const args = parseArgs(process.argv.slice(2))

const reportPath = path.resolve(repoRoot, args.report ?? path.join(defaultReportDir, 'report.md'))
const jsonReportPath = path.resolve(repoRoot, args.json ?? path.join(defaultReportDir, 'report.json'))
const keepWorkspaces = args.keepWorkspaces === true
const selectedRecipes = new Set(splitCsv(args.recipe))
const selectedTiers = new Set(splitCsv(args.tier))
const fullMatrixAll = args.fullMatrixAll === true
const commandTimeoutMs = Number(args.timeoutMs ?? 180_000)

const forbiddenLifecycleScripts = new Set([
  'preinstall',
  'install',
  'postinstall',
  'prepublish',
  'prepublishOnly',
  'prepare',
  'prepack',
  'postpack',
])
const forbiddenScriptFragments = [
  'curl ',
  'wget ',
  'chmod ',
  'sudo ',
  'rm -rf',
  'bash -c',
  'sh -c',
  'powershell',
]
const forbiddenDependencyProtocols = /^(?:git\+|git:|https?:|file:|link:|portal:|workspace:)/

const recipes = await loadRecipes()
const recipesToVerify = recipes.filter(shouldVerifyRecipe)

if (recipesToVerify.length === 0) {
  console.error('No recipes matched the verification filters.')
  process.exit(1)
}

const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'scaffolder-recipes-'))
const port = await freePort()
const apiUrl = `http://127.0.0.1:${port}`
const api = spawnApi(port)
const results = []

try {
  await waitForReady(apiUrl)

  for (const recipe of recipesToVerify) {
    const variants = optionVariants(recipe, recipe.tier === 'recommended' || fullMatrixAll)
    for (const variant of variants) {
      const result = await verifyVariant(apiUrl, recipe, variant)
      results.push(result)
      printResult(result)
    }
  }

  await writeReports(results)
} finally {
  api.kill('SIGTERM')
  if (!keepWorkspaces) {
    await rm(workspaceRoot, { recursive: true, force: true })
  } else {
    console.log(`Kept verification workspaces at ${workspaceRoot}`)
  }
}

const failures = results.filter((result) => result.status === 'failed')
if (failures.length > 0) {
  console.error(`Recipe project verification failed: ${failures.length} failing variant(s)`)
  process.exit(1)
}

console.log(`Recipe project verification passed: ${results.length} variant(s)`)

async function verifyVariant(apiUrl, recipe, variant) {
  const startedAt = Date.now()
  const projectName = safeProjectName(`verify-${recipe.id}-${variant.index}`)
  const request = {
    projectName,
    options: variant.options,
    extras: {
      dependencies: [],
      devDependencies: [],
    },
  }
  const result = {
    recipeId: recipe.id,
    recipeTier: recipe.tier,
    recipeStatus: recipe.status,
    variant: variant.label,
    options: variant.options,
    status: 'passed',
    durationMs: 0,
    checks: [],
    dependencies: [],
    devDependencies: [],
    commands: [],
    workspace: null,
  }

  const fail = (check, message, details) => {
    result.status = 'failed'
    result.checks.push({ name: check, status: 'failed', message, details })
  }
  const pass = (check, message, details) => {
    result.checks.push({ name: check, status: 'passed', message, details })
  }
  const skip = (check, message) => {
    result.checks.push({ name: check, status: 'skipped', message })
  }

  try {
    const preview = await postJson(`${apiUrl}/recipes/${recipe.id}/preview`, request)
    result.commands = preview.commands ?? []
    result.dependencies = preview.dependencies ?? []
    result.devDependencies = preview.devDependencies ?? []
    validatePreviewSmoke(preview)
    pass('preview', 'Preview endpoint returned tree, curated tree, selected files, commands, and verification metadata.')

    const archivePath = path.join(workspaceRoot, `${projectName}.zip`)
    await downloadArchive(`${apiUrl}/recipes/${recipe.id}/generate`, request, archivePath)
    pass('generate', 'Generate endpoint returned a ZIP archive.')

    const extractRoot = path.join(workspaceRoot, projectName)
    await mkdir(extractRoot, { recursive: true })
    const unzip = await runCommand('unzip', ['-q', archivePath, '-d', extractRoot], { timeoutMs: commandTimeoutMs })
    if (unzip.code !== 0) {
      fail('generate', 'Generated ZIP could not be extracted.', outputDetails(unzip))
      return finish(result, startedAt)
    }

    const projectRoot = await findGeneratedProjectRoot(extractRoot, projectName)
    result.workspace = projectRoot

    const packageJson = await readJson(path.join(projectRoot, 'package.json'))
    validatePackageScripts(packageJson)
    await validateNoForbiddenHookFiles(projectRoot)
    pass('scripts', 'No forbidden lifecycle scripts, hook files, or suspicious command fragments were found.')

    validateDependencies(packageJson)
    pass('dependencies', 'Dependency names and version specifiers passed static review.')

    const installCommand = canonicalInstallCommand(preview.commands)
    const install = await runShellCommand(installCommand, { cwd: projectRoot, timeoutMs: commandTimeoutMs })
    if (install.code !== 0) {
      fail('install', `${installCommand} failed.`, outputDetails(install))
      return finish(result, startedAt)
    }
    pass('install', `${installCommand} completed successfully.`)

    const scripts = packageJson.scripts ?? {}
    if (typeof scripts.build === 'string') {
      const build = await runCommand('npm', ['run', 'build'], { cwd: projectRoot, timeoutMs: commandTimeoutMs })
      if (build.code !== 0) {
        fail('build', 'npm run build failed.', outputDetails(build))
        return finish(result, startedAt)
      }
      pass('build', 'npm run build completed successfully.')
    } else {
      fail('build', 'package.json does not define a build script.')
      return finish(result, startedAt)
    }

    if (typeof scripts.test === 'string') {
      const test = await runCommand('npm', ['test'], { cwd: projectRoot, timeoutMs: commandTimeoutMs })
      if (test.code !== 0) {
        fail('test', 'npm test failed.', outputDetails(test))
        return finish(result, startedAt)
      }
      pass('test', 'npm test completed successfully.')
    } else if (recipe.verification?.test === 'required') {
      fail('test', 'Recipe verification requires tests, but package.json has no test script.')
      return finish(result, startedAt)
    } else {
      skip('test', 'No test script is enabled for this variant.')
    }
  } catch (error) {
    fail('verification', error.message)
  }

  return finish(result, startedAt)
}

function validatePreviewSmoke(preview) {
  if (!preview || typeof preview !== 'object') {
    throw new Error('Preview response must be an object.')
  }
  if (!preview.tree || !preview.curatedTree) {
    throw new Error('Preview response must include tree and curatedTree.')
  }
  if (!Array.isArray(preview.selectedFiles) || preview.selectedFiles.length === 0) {
    throw new Error('Preview response must include selectedFiles.')
  }
  if (!preview.selectedFiles.some((file) => file.path === 'package.json')) {
    throw new Error('Preview selectedFiles must include package.json.')
  }
  if (!Array.isArray(preview.commands) || preview.commands.length === 0) {
    throw new Error('Preview response must include commands.')
  }
  if (!preview.verification || typeof preview.verification !== 'object') {
    throw new Error('Preview response must include verification metadata.')
  }
  if (!preview.templateSnapshot) {
    throw new Error('Preview response must include templateSnapshot.')
  }
}

function validatePackageScripts(packageJson) {
  const scripts = packageJson.scripts ?? {}
  for (const [name, command] of Object.entries(scripts)) {
    if (forbiddenLifecycleScripts.has(name)) {
      throw new Error(`Forbidden package lifecycle script: ${name}`)
    }
    if (typeof command !== 'string') {
      throw new Error(`package.json script "${name}" must be a string.`)
    }
    const normalized = command.toLowerCase()
    const forbidden = forbiddenScriptFragments.find((fragment) => normalized.includes(fragment))
    if (forbidden) {
      throw new Error(`package.json script "${name}" contains forbidden fragment "${forbidden.trim()}".`)
    }
  }
}

async function validateNoForbiddenHookFiles(projectRoot) {
  const forbiddenPaths = new Set([
    '.husky',
    '.git/hooks',
    'lefthook.yml',
    'lefthook.yaml',
    '.lintstagedrc',
    '.lintstagedrc.json',
    '.lintstagedrc.js',
    'lint-staged.config.js',
    'lint-staged.config.cjs',
    'lint-staged.config.mjs',
    'lint-staged.config.ts',
  ])
  const paths = await walkProject(projectRoot)
  for (const relativePath of paths) {
    if (forbiddenPaths.has(relativePath)) {
      throw new Error(`Forbidden hook file or directory generated: ${relativePath}`)
    }
  }
}

async function walkProject(root, dir = root) {
  const entries = await readdir(dir, { withFileTypes: true })
  const paths = []
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    const relative = path.relative(root, absolute).split(path.sep).join('/')
    paths.push(relative)
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      paths.push(...await walkProject(root, absolute))
    }
  }
  return paths
}

function validateDependencies(packageJson) {
  const seen = new Set()
  for (const bucket of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const deps = packageJson[bucket] ?? {}
    if (deps === undefined) continue
    if (!deps || typeof deps !== 'object' || Array.isArray(deps)) {
      throw new Error(`package.json ${bucket} must be an object.`)
    }

    for (const [name, version] of Object.entries(deps)) {
      if (!isPackageName(name)) {
        throw new Error(`Invalid dependency name in ${bucket}: ${name}`)
      }
      if (typeof version !== 'string' || version.trim() === '') {
        throw new Error(`Dependency ${name} in ${bucket} must have a non-empty string version.`)
      }
      if (forbiddenDependencyProtocols.test(version)) {
        throw new Error(`Dependency ${name} in ${bucket} uses forbidden version specifier "${version}".`)
      }
      if (seen.has(name)) {
        throw new Error(`Dependency ${name} is declared in more than one dependency bucket.`)
      }
      seen.add(name)
    }
  }
}

function canonicalInstallCommand(commands) {
  const install = commands?.find((command) => /\b(?:npm|pnpm|yarn|bun)\s+(?:install|ci)\b/.test(command))
  return install ?? 'npm install'
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

async function downloadArchive(url, body, archivePath) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${await response.text()}`)
  }

  await mkdir(path.dirname(archivePath), { recursive: true })
  await writeFile(archivePath, Buffer.from(await response.arrayBuffer()))
}

async function findGeneratedProjectRoot(extractRoot, projectName) {
  const expected = path.join(extractRoot, projectName)
  try {
    const stat = await readFile(path.join(expected, 'package.json'), 'utf8')
    if (stat) return expected
  } catch {
    // Fall through to single-directory detection.
  }

  const entries = await readdir(extractRoot, { withFileTypes: true })
  const dirs = entries.filter((entry) => entry.isDirectory())
  if (dirs.length === 1) {
    return path.join(extractRoot, dirs[0].name)
  }
  throw new Error(`Could not locate generated project root under ${extractRoot}`)
}

function runShellCommand(command, options) {
  const [program, ...args] = command.split(/\s+/).filter(Boolean)
  return runCommand(program, args, options)
}

function runCommand(program, commandArgs, { cwd = repoRoot, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(program, commandArgs, {
      cwd,
      env: {
        ...process.env,
        CI: 'true',
      },
      shell: false,
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal, stdout, stderr })
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: 1, signal: null, stdout, stderr: `${stderr}\n${error.message}` })
    })
  })
}

function outputDetails(result) {
  return {
    stdout: trimOutput(result.stdout),
    stderr: trimOutput(result.stderr),
    signal: result.signal ?? undefined,
  }
}

function trimOutput(value) {
  const normalized = String(value ?? '').trim()
  if (normalized.length <= 4000) return normalized
  return `${normalized.slice(0, 4000)}\n[output truncated]`
}

function finish(result, startedAt) {
  result.durationMs = Date.now() - startedAt
  return result
}

function printResult(result) {
  const label = `${result.recipeId} ${result.variant}`
  if (result.status === 'passed') {
    console.log(`PASS ${label} (${result.durationMs}ms)`)
    return
  }

  console.error(`FAIL ${label} (${result.durationMs}ms)`)
  for (const check of result.checks.filter((check) => check.status === 'failed')) {
    console.error(`- ${check.name}: ${check.message}`)
  }
}

async function writeReports(results) {
  await mkdir(path.dirname(reportPath), { recursive: true })
  await mkdir(path.dirname(jsonReportPath), { recursive: true })
  await writeFile(jsonReportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`)
  await writeFile(reportPath, markdownReport(results))
  console.log(`Recipe verification report: ${path.relative(repoRoot, reportPath)}`)
}

function markdownReport(results) {
  const passCount = results.filter((result) => result.status === 'passed').length
  const failCount = results.filter((result) => result.status === 'failed').length
  const recommendedCount = results.filter((result) => result.recipeTier === 'recommended').length
  const rows = results.map((result) => {
    const checks = ['preview', 'generate', 'scripts', 'dependencies', 'install', 'build', 'test']
      .map((name) => `${name}:${checkStatus(result, name)}`)
      .join('<br>')
    return `| \`${result.recipeId}\` | ${result.recipeTier} | \`${result.variant}\` | ${result.status.toUpperCase()} | ${checks} |`
  })

  return [
    '# Recipe Verification Report',
    '',
    `- Passed variants: ${passCount}`,
    `- Failed variants: ${failCount}`,
    `- Recommended variants verified: ${recommendedCount}`,
    '',
    '| Recipe | Tier | Variant | Status | Checks |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    'Recommended recipes are verified with their full option matrix. Community and experimental recipes use their default baseline unless `--full-matrix-all` is passed.',
    '',
  ].join('\n')
}

function checkStatus(result, name) {
  return result.checks.find((check) => check.name === name)?.status ?? 'missing'
}

function spawnApi(port) {
  const logPath = path.join(workspaceRoot, 'api.log')
  const log = createWriteStream(logPath)
  const child = spawn('cargo', ['run', '--manifest-path', 'apps/api/Cargo.toml', '--locked'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SCAFFOLDER_API_ADDR: `127.0.0.1:${port}`,
    },
    shell: false,
  })
  child.stdout.pipe(log)
  child.stderr.pipe(log)
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Recipe verification API exited with ${code}. Log: ${logPath}`)
    }
  })
  return child
}

async function waitForReady(apiUrl) {
  const deadline = Date.now() + 60_000
  let lastError = ''
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiUrl}/ready`)
      if (response.ok) return
      lastError = `${response.status} ${await response.text()}`
    } catch (error) {
      lastError = error.message
    }
    await sleep(500)
  }
  throw new Error(`Timed out waiting for recipe verification API at ${apiUrl}: ${lastError}`)
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolve(address.port))
    })
    server.on('error', reject)
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadRecipes() {
  const files = (await readdir(recipesRoot))
    .filter((file) => file.endsWith('.json'))
    .sort()
  const loaded = []
  for (const file of files) {
    loaded.push(await readJson(path.join(recipesRoot, file)))
  }
  return loaded
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

function shouldVerifyRecipe(recipe) {
  if (recipe.tier === 'deprecated' || recipe.status === 'deprecated') {
    return false
  }
  if (selectedRecipes.size > 0 && !selectedRecipes.has(recipe.id)) {
    return false
  }
  if (selectedTiers.size > 0 && !selectedTiers.has(recipe.tier)) {
    return false
  }
  return true
}

function optionVariants(recipe, fullMatrix) {
  const optionEntries = Object.entries(recipe.options ?? {})
  const defaults = Object.fromEntries(optionEntries.map(([key, option]) => [key, option.default]))
  if (!fullMatrix || optionEntries.length === 0) {
    return [{ index: 1, label: 'default', options: defaults }]
  }

  const variants = []
  const walk = (index, current, labels) => {
    if (index === optionEntries.length) {
      variants.push({
        index: variants.length + 1,
        label: labels.every((label) => label.endsWith('=default')) ? 'default' : labels.join(','),
        options: { ...current },
      })
      return
    }

    const [key, option] = optionEntries[index]
    for (const value of option.values) {
      current[key] = value.id
      const labelValue = value.id === option.default ? 'default' : value.id
      walk(index + 1, current, [...labels, `${key}=${labelValue}`])
    }
  }

  walk(0, {}, [])
  return variants
}

function safeProjectName(value) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
}

function isPackageName(value) {
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value)
}

function splitCsv(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => splitCsv(item))
  }
  if (!value) return []
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseArgs(values) {
  const parsed = {}
  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index]
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`)
    }
    const [rawKey, inlineValue] = arg.slice(2).split('=', 2)
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    if (inlineValue !== undefined) {
      assignArg(parsed, key, inlineValue)
      continue
    }
    const next = values[index + 1]
    if (!next || next.startsWith('--')) {
      assignArg(parsed, key, true)
      continue
    }
    assignArg(parsed, key, next)
    index += 1
  }
  return parsed
}

function assignArg(target, key, value) {
  if (target[key] === undefined) {
    target[key] = value
  } else if (Array.isArray(target[key])) {
    target[key].push(value)
  } else {
    target[key] = [target[key], value]
  }
}
