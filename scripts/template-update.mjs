import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  access,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseTemplateRoot = path.join(repoRoot, 'recipes', 'base-templates')
const recipeRoot = path.join(repoRoot, 'recipes', 'catalog')
const defaultReportDir = path.join(repoRoot, 'artifacts', 'template-updates')
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
const expectedPathPatterns = [
  /^\.gitignore$/,
  /^\.vscode\/[^/]+$/,
  /^README\.md$/,
  /^eslint\.config\.[cm]?js$/,
  /^index\.html$/,
  /^package(?:-lock)?\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^bun\.lockb?$/,
  /^public\/.+$/,
  /^src\/.+$/,
  /^tsconfig(?:\.[a-z]+)?\.json$/,
  /^vite\.config\.[cm]?tsx?$/,
]
const licenseMetadataPatterns = [
  /^LICENSE(?:\..*)?$/i,
  /^LICENCE(?:\..*)?$/i,
  /^NOTICE(?:\..*)?$/i,
  /^COPYING(?:\..*)?$/i,
]
const requiredTemplateFiles = ['package.json', 'index.html']

const [command, ...rawArgs] = process.argv.slice(2)
const args = parseArgs(rawArgs)

switch (command) {
  case 'hash':
    await commandHash(args)
    break
  case 'verify-lock':
    await commandVerifyLock()
    break
  case 'classify':
    await commandClassify(args)
    break
  case 'pr-plan':
    await commandPrPlan(args)
    break
  default:
    printHelp()
    process.exit(command ? 1 : 0)
}

async function commandHash(args) {
  if (!args.path) {
    throw new Error('hash requires --path')
  }
  console.log(await snapshotHash(path.resolve(repoRoot, args.path)))
}

async function commandVerifyLock() {
  const baseTemplates = await loadBaseTemplates()
  const recipes = await loadRecipes()
  const submoduleCommit = await gitOutput(['-C', 'apps/api/templates', 'rev-parse', 'HEAD'])
  const errors = []
  const counts = { candidate: 0, verified: 0, promoted: 0 }

  for (const manifest of baseTemplates) {
    counts[manifest.status] = (counts[manifest.status] ?? 0) + 1
    const context = manifest.__file
    if (!manifest.snapshot || typeof manifest.snapshot !== 'object') {
      errors.push(`${context}: missing snapshot metadata`)
      continue
    }
    if (manifest.snapshot.commit !== submoduleCommit) {
      errors.push(
        `${context}: snapshot.commit ${manifest.snapshot.commit} does not match templates submodule ${submoduleCommit}`,
      )
    }
    if (manifest.snapshot.path !== path.basename(manifest.snapshotPath)) {
      errors.push(
        `${context}: snapshot.path ${manifest.snapshot.path} does not match snapshotPath ${manifest.snapshotPath}`,
      )
    }
    const actualHash = await snapshotHash(path.join(repoRoot, manifest.snapshotPath))
    if (manifest.snapshot.hash !== actualHash) {
      errors.push(`${context}: snapshot.hash ${manifest.snapshot.hash} does not match ${actualHash}`)
    }
  }

  for (const recipe of recipes) {
    if (recipe.status === 'deprecated' || recipe.tier === 'deprecated') {
      continue
    }
    const baseTemplate = baseTemplates.find((manifest) => manifest.id === recipe.baseTemplate)
    if (baseTemplate?.status !== 'promoted') {
      errors.push(
        `${recipe.__file}: runtime recipe ${recipe.id} references non-promoted base template ${recipe.baseTemplate}`,
      )
    }
  }

  if (errors.length > 0) {
    console.error(`Template snapshot verification failed with ${errors.length} error(s):`)
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(
    `Template snapshots verified: ${baseTemplates.length} base template(s), ` +
      `submodule ${submoduleCommit}, states candidate=${counts.candidate ?? 0} ` +
      `verified=${counts.verified ?? 0} promoted=${counts.promoted ?? 0}`,
  )
}

async function commandClassify(args) {
  if (!args.template) {
    throw new Error('classify requires --template')
  }
  if (!args.candidate) {
    throw new Error('classify requires --candidate')
  }

  const baseTemplates = await loadBaseTemplates()
  const manifest = baseTemplates.find((item) => item.id === args.template)
  if (!manifest) {
    throw new Error(`Unknown base template: ${args.template}`)
  }

  const currentPath = path.join(repoRoot, manifest.snapshotPath)
  const candidatePath = path.resolve(repoRoot, args.candidate)
  await assertDirectory(currentPath)
  await assertDirectory(candidatePath)

  const reportPath = path.resolve(repoRoot, args.report ?? path.join(defaultReportDir, `${manifest.id}.md`))
  const jsonReportPath = path.resolve(repoRoot, args.json ?? path.join(defaultReportDir, `${manifest.id}.json`))
  const affectedRecipes = await recipesUsingBaseTemplate(manifest.id)
  const diff = await compareDirectories(currentPath, candidatePath)
  const packageReview = await comparePackageJson(currentPath, candidatePath)
  const triggers = [
    ...classifyPathRisk(diff),
    ...classifyPackageRisk(packageReview),
    ...classifyVersionRisk(args),
    ...classifySizeRisk(diff),
  ]

  let verification = { status: 'not-run', command: affectedVerificationCommand(affectedRecipes) }
  if (args.verifyAffected === true) {
    verification = await verifyAffectedRecipes(affectedRecipes)
    if (verification.status !== 'passed') {
      triggers.push('affected recipe verification failed')
    }
  }

  const candidateHash = await snapshotHash(candidatePath)
  const autoPromotionEligible = triggers.length === 0 && verification.status !== 'failed'
  const report = {
    templateId: manifest.id,
    currentSnapshotPath: path.relative(repoRoot, currentPath),
    candidatePath: path.relative(repoRoot, candidatePath),
    currentHash: await snapshotHash(currentPath),
    candidateHash,
    affectedRecipes,
    diff,
    packageReview,
    triggers,
    autoPromotionEligible,
    verification,
    generatedAt: new Date().toISOString(),
  }

  await writeReport(reportPath, jsonReportPath, report)
  console.log(`Template update classification: ${autoPromotionEligible ? 'safe-auto-promotion' : 'manual-review-required'}`)
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`)
  if (!autoPromotionEligible) {
    for (const trigger of triggers) {
      console.log(`- ${trigger}`)
    }
  }
}

async function commandPrPlan(args) {
  if (!args.report) {
    throw new Error('pr-plan requires --report')
  }
  const report = JSON.parse(await readFile(path.resolve(repoRoot, args.report), 'utf8'))
  console.log(prPlan(report))
}

async function compareDirectories(currentPath, candidatePath) {
  const currentFiles = await fileMap(currentPath)
  const candidateFiles = await fileMap(candidatePath)
  const paths = new Set([...currentFiles.keys(), ...candidateFiles.keys()])
  const added = []
  const removed = []
  const modified = []
  let changedBytes = 0

  for (const relativePath of [...paths].sort()) {
    const current = currentFiles.get(relativePath)
    const candidate = candidateFiles.get(relativePath)
    if (!current) {
      added.push(relativePath)
      changedBytes += candidate.size
      continue
    }
    if (!candidate) {
      removed.push(relativePath)
      changedBytes += current.size
      continue
    }
    if (current.hash !== candidate.hash) {
      modified.push(relativePath)
      changedBytes += Math.abs(candidate.size - current.size)
    }
  }

  return {
    added,
    removed,
    modified,
    changedFiles: added.length + removed.length + modified.length,
    changedBytes,
  }
}

async function comparePackageJson(currentPath, candidatePath) {
  const current = await readJsonIfExists(path.join(currentPath, 'package.json'))
  const candidate = await readJsonIfExists(path.join(candidatePath, 'package.json'))
  const review = {
    scriptsAdded: [],
    scriptsRemoved: [],
    scriptsModified: [],
    lifecycleScriptsAdded: [],
    suspiciousScripts: [],
    dependencyChanges: [],
    suspiciousDependencies: [],
    metadataChanges: [],
    packageManagerChanged: false,
  }

  if (!current || !candidate) {
    review.metadataChanges.push('package.json added or removed')
    return review
  }

  const currentScripts = current.scripts ?? {}
  const candidateScripts = candidate.scripts ?? {}
  const scriptNames = new Set([...Object.keys(currentScripts), ...Object.keys(candidateScripts)])
  for (const name of [...scriptNames].sort()) {
    const before = currentScripts[name]
    const after = candidateScripts[name]
    if (before === undefined) {
      review.scriptsAdded.push(name)
    } else if (after === undefined) {
      review.scriptsRemoved.push(name)
    } else if (before !== after) {
      review.scriptsModified.push(name)
    }
    if (before === undefined && after !== undefined && forbiddenLifecycleScripts.has(name)) {
      review.lifecycleScriptsAdded.push(name)
    }
    if (typeof after === 'string') {
      const normalized = after.toLowerCase()
      const fragment = forbiddenScriptFragments.find((item) => normalized.includes(item))
      if (fragment) {
        review.suspiciousScripts.push(`${name}: ${fragment.trim()}`)
      }
    }
  }

  const dependencyBuckets = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
  for (const bucket of dependencyBuckets) {
    const beforeDeps = current[bucket] ?? {}
    const afterDeps = candidate[bucket] ?? {}
    const names = new Set([...Object.keys(beforeDeps), ...Object.keys(afterDeps)])
    for (const name of [...names].sort()) {
      const before = beforeDeps[name]
      const after = afterDeps[name]
      if (before !== after) {
        review.dependencyChanges.push({
          bucket,
          name,
          before: before ?? null,
          after: after ?? null,
          majorChange: isMajorVersionChange(before, after),
        })
      }
      if (typeof after === 'string' && forbiddenDependencyProtocols.test(after)) {
        review.suspiciousDependencies.push(`${bucket}.${name}: ${after}`)
      }
    }
  }

  for (const key of ['license', 'author', 'contributors', 'homepage', 'repository', 'funding']) {
    if (JSON.stringify(current[key] ?? null) !== JSON.stringify(candidate[key] ?? null)) {
      review.metadataChanges.push(key)
    }
  }
  review.packageManagerChanged = current.packageManager !== candidate.packageManager

  return review
}

function classifyPathRisk(diff) {
  const triggers = []
  const changed = [...diff.added, ...diff.removed, ...diff.modified]
  const unexpected = changed.filter((file) => !expectedPathPatterns.some((pattern) => pattern.test(file)))
  if (unexpected.length > 0) {
    triggers.push(`diff touches unexpected files: ${unexpected.slice(0, 8).join(', ')}`)
  }
  const licenseChanges = changed.filter((file) => licenseMetadataPatterns.some((pattern) => pattern.test(file)))
  if (licenseChanges.length > 0) {
    triggers.push(`license/source metadata changed: ${licenseChanges.join(', ')}`)
  }
  for (const required of requiredTemplateFiles) {
    if (diff.removed.includes(required)) {
      triggers.push(`required template file removed: ${required}`)
    }
  }
  if (diff.added.some((file) => /^(?:\.husky|\.git\/hooks)\//.test(file))) {
    triggers.push('new hook directory added')
  }
  return triggers
}

function classifyPackageRisk(review) {
  const triggers = []
  if (review.lifecycleScriptsAdded.length > 0) {
    triggers.push(`new lifecycle scripts: ${review.lifecycleScriptsAdded.join(', ')}`)
  }
  if (review.suspiciousScripts.length > 0) {
    triggers.push(`suspicious script commands: ${review.suspiciousScripts.join(', ')}`)
  }
  if (review.suspiciousDependencies.length > 0) {
    triggers.push(`suspicious dependency specifiers: ${review.suspiciousDependencies.join(', ')}`)
  }
  if (review.metadataChanges.length > 0) {
    triggers.push(`package metadata changed: ${review.metadataChanges.join(', ')}`)
  }
  if (review.packageManagerChanged) {
    triggers.push('package manager behavior changed')
  }
  const majorChanges = review.dependencyChanges.filter((change) => change.majorChange)
  if (majorChanges.length > 0) {
    triggers.push(`major dependency updates: ${majorChanges.map((change) => change.name).join(', ')}`)
  }
  return triggers
}

function classifyVersionRisk(args) {
  const from = args.upstreamVersionFrom
  const to = args.upstreamVersionTo
  if (!from || !to) return []
  const beforeMajor = Number(String(from).replace(/^[^\d]*/, '').split('.')[0])
  const afterMajor = Number(String(to).replace(/^[^\d]*/, '').split('.')[0])
  if (Number.isFinite(beforeMajor) && Number.isFinite(afterMajor) && afterMajor > beforeMajor) {
    return [`major upstream update: ${from} -> ${to}`]
  }
  return []
}

function classifySizeRisk(diff) {
  const triggers = []
  if (diff.changedFiles > 30) {
    triggers.push(`large diff: ${diff.changedFiles} changed files`)
  }
  if (diff.changedBytes > 100_000) {
    triggers.push(`large diff: ${diff.changedBytes} changed bytes`)
  }
  return triggers
}

async function verifyAffectedRecipes(recipeIds) {
  if (recipeIds.length === 0) {
    return { status: 'skipped', command: '', exitCode: 0 }
  }
  const commandArgs = [
    'verify:recipes:projects',
    '--',
    '--recipe',
    recipeIds.join(','),
    '--full-matrix-all',
  ]
  const result = await runCommand('pnpm', commandArgs, { stdio: 'inherit' })
  return {
    status: result.code === 0 ? 'passed' : 'failed',
    command: `pnpm ${commandArgs.join(' ')}`,
    exitCode: result.code,
  }
}

function affectedVerificationCommand(recipeIds) {
  if (recipeIds.length === 0) {
    return ''
  }
  return `pnpm verify:recipes:projects -- --recipe ${recipeIds.join(',')} --full-matrix-all`
}

async function recipesUsingBaseTemplate(baseTemplateId) {
  const recipes = await loadRecipes()
  return recipes
    .filter((recipe) => recipe.baseTemplate === baseTemplateId)
    .map((recipe) => recipe.id)
    .sort()
}

async function writeReport(reportPath, jsonReportPath, report) {
  await mkdir(path.dirname(reportPath), { recursive: true })
  await mkdir(path.dirname(jsonReportPath), { recursive: true })
  await writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(reportPath, markdownReport(report))
}

function markdownReport(report) {
  const lines = [
    '# Template Update Classification',
    '',
    `- Template: \`${report.templateId}\``,
    `- Current snapshot: \`${report.currentSnapshotPath}\``,
    `- Candidate: \`${report.candidatePath}\``,
    `- Current hash: \`${report.currentHash}\``,
    `- Candidate hash: \`${report.candidateHash}\``,
    `- Affected recipes: ${report.affectedRecipes.map((recipe) => `\`${recipe}\``).join(', ') || 'none'}`,
    `- Result: ${report.autoPromotionEligible ? 'safe auto-promotion candidate' : 'manual review required'}`,
    '',
    '## Diff',
    '',
    `- Added: ${report.diff.added.length}`,
    `- Removed: ${report.diff.removed.length}`,
    `- Modified: ${report.diff.modified.length}`,
    `- Changed bytes: ${report.diff.changedBytes}`,
    '',
    '## Review Triggers',
    '',
    ...(report.triggers.length > 0 ? report.triggers.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Affected Recipe Verification',
    '',
    `- Status: ${report.verification.status}`,
    report.verification.command ? `- Command: \`${report.verification.command}\`` : '- Command: not required',
    '',
    '## PR Plan',
    '',
    prPlan(report),
    '',
  ]
  return lines.join('\n')
}

function prPlan(report) {
  return [
    '### Templates repository PR',
    '',
    `- [ ] Update \`${report.templateId}\` snapshot files.`,
    `- [ ] Include classification report for candidate hash \`${report.candidateHash}\`.`,
    '- [ ] Confirm no runtime generation path fetches upstream sources.',
    '- [ ] Confirm candidate snapshot is reproducible from the documented upstream source.',
    report.autoPromotionEligible
      ? '- [ ] Auto-promotion criteria passed; maintainer may promote after reviewing report.'
      : '- [ ] Manual review required before promotion.',
    '',
    '### Scaffolder bump PR',
    '',
    '- [ ] Bump `apps/api/templates` submodule pointer to the promoted templates commit.',
    '- [ ] Update base-template snapshot metadata commit/hash.',
    '- [ ] Run `pnpm verify:templates`.',
    '- [ ] Run affected recipe verification.',
    '- [ ] Do not mix recipe behavior changes into the template bump.',
  ].join('\n')
}

async function snapshotHash(snapshotPath) {
  const files = await fileMap(snapshotPath)
  const hash = createHash('sha256')
  for (const [relativePath, file] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(relativePath)
    hash.update('\0')
    hash.update(file.hash)
    hash.update('\0')
  }
  return `sha256:${hash.digest('hex')}`
}

async function fileMap(root) {
  const map = new Map()
  await walkFiles(root, root, map)
  return map
}

async function walkFiles(root, dir, map) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    const relative = path.relative(root, absolute).split(path.sep).join('/')
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
        continue
      }
      await walkFiles(root, absolute, map)
      continue
    }
    if (!entry.isFile()) {
      continue
    }
    const bytes = await readFile(absolute)
    map.set(relative, {
      hash: createHash('sha256').update(bytes).digest('hex'),
      size: bytes.length,
    })
  }
}

async function loadBaseTemplates() {
  return loadJsonDirectory(baseTemplateRoot)
}

async function loadRecipes() {
  return loadJsonDirectory(recipeRoot)
}

async function loadJsonDirectory(dir) {
  const files = (await readdir(dir))
    .filter((file) => file.endsWith('.json'))
    .sort()
  const manifests = []
  for (const file of files) {
    const filePath = path.join(dir, file)
    const manifest = JSON.parse(await readFile(filePath, 'utf8'))
    manifest.__file = path.relative(repoRoot, filePath)
    manifests.push(manifest)
  }
  return manifests
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

async function assertDirectory(dir) {
  await access(dir)
  const info = await stat(dir)
  if (!info.isDirectory()) {
    throw new Error(`Expected directory: ${dir}`)
  }
}

async function gitOutput(args) {
  const result = await runCommand('git', args)
  if (result.code !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

function runCommand(program, commandArgs, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(program, commandArgs, {
      cwd: repoRoot,
      env: { ...process.env, CI: 'true' },
      shell: false,
      stdio: options.stdio ?? 'pipe',
    })
    let stdout = ''
    let stderr = ''
    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
    }
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
    }
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` }))
  })
}

function isMajorVersionChange(before, after) {
  const beforeMajor = majorVersion(before)
  const afterMajor = majorVersion(after)
  return beforeMajor !== null && afterMajor !== null && beforeMajor !== afterMajor
}

function majorVersion(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/\d+/)
  if (!match) return null
  return Number(match[0])
}

function parseArgs(values) {
  const parsed = {}
  const normalizedValues = values.filter((value) => value !== '--')
  for (let index = 0; index < normalizedValues.length; index += 1) {
    const arg = normalizedValues[index]
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`)
    }
    const [rawKey, inlineValue] = arg.slice(2).split('=', 2)
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue
      continue
    }
    const next = normalizedValues[index + 1]
    if (!next || next.startsWith('--')) {
      parsed[key] = true
      continue
    }
    parsed[key] = next
    index += 1
  }
  return parsed
}

function printHelp() {
  console.log(`Usage:
  node scripts/template-update.mjs verify-lock
  node scripts/template-update.mjs hash --path apps/api/templates/react-ts
  node scripts/template-update.mjs classify --template vite-react-ts --candidate <path> [--verify-affected]
  node scripts/template-update.mjs pr-plan --report artifacts/template-updates/vite-react-ts.json`)
}
