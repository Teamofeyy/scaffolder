import { execFile, spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { access, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = process.env.SCAFFOLDER_MATRIX_BASE_URL ?? 'http://127.0.0.1:8000'
const keepOutput = process.env.SCAFFOLDER_MATRIX_KEEP_OUTPUT === '1'
const installCommand = process.env.SCAFFOLDER_MATRIX_INSTALL_COMMAND ?? 'npm install'
const buildCommand = process.env.SCAFFOLDER_MATRIX_BUILD_COMMAND ?? 'npm run build'

const matrix = [
  ['react-base', { framework: 'react', routing: 'none', styling: 'css-modules' }],
  ['react-tailwind', { framework: 'react', routing: 'none', styling: 'tailwind' }],
  ['react-router-base', { framework: 'react', routing: 'react-router', styling: 'css-modules' }],
  ['react-router-tailwind', { framework: 'react', routing: 'react-router', styling: 'tailwind' }],
  ['react-router-data-base', { framework: 'react', routing: 'react-router-data', styling: 'css-modules' }],
  ['react-router-data-tailwind', { framework: 'react', routing: 'react-router-data', styling: 'tailwind' }],
  ['vue-base', { framework: 'vue', routing: 'none', styling: 'css-modules' }],
  ['vue-tailwind', { framework: 'vue', routing: 'none', styling: 'tailwind' }],
  ['vue-router-base', { framework: 'vue', routing: 'vue-router', styling: 'css-modules' }],
  ['vue-router-tailwind', { framework: 'vue', routing: 'vue-router', styling: 'tailwind' }],
  ['next-app-base', { framework: 'nextjs', routing: 'app-router', styling: 'css-modules' }],
  ['next-app-tailwind', { framework: 'nextjs', routing: 'app-router', styling: 'tailwind' }],
  ['next-pages-base', { framework: 'nextjs', routing: 'pages-router', styling: 'css-modules' }],
  ['next-pages-tailwind', { framework: 'nextjs', routing: 'pages-router', styling: 'tailwind' }],
]

let backend
const outputRoot = await mkdtemp(path.join(tmpdir(), 'scaffolder-stable-matrix-'))

try {
  await ensureBackend()

  for (const [name, options] of matrix) {
    await verifyCase(name, {
      ...options,
      linting: 'eslint',
      state_management: 'none',
      dependencies: [],
      dev_dependencies: [],
      testing: 'none',
    })
  }

  const presets = await fetchJson(`${baseUrl}/presets`)
  const supportedPresets = presets.filter((preset) => preset.status === 'supported')
  for (const preset of supportedPresets) {
    await verifyCase(`preset-${preset.id}`, {
      ...preset.config,
      dependencies: preset.config.dependencies ?? [],
      dev_dependencies: preset.config.dev_dependencies ?? [],
      testing: preset.config.testing ?? 'none',
    })
  }

  console.log(`Stable matrix verified: ${matrix.length}/${matrix.length}`)
  console.log(`Supported presets verified: ${supportedPresets.length}/${supportedPresets.length}`)
  if (keepOutput) {
    console.log(`Output kept at ${outputRoot}`)
  }
} finally {
  if (!keepOutput) {
    await rm(outputRoot, { recursive: true, force: true })
  }
  if (backend) {
    backend.kill('SIGTERM')
  }
}

async function verifyCase(name, options) {
  const projectName = `stable-${name}`
  const caseDir = path.join(outputRoot, name)
  await rm(caseDir, { recursive: true, force: true })
  await mkdir(caseDir, { recursive: true })

  console.log(`==> ${name}: generate`)
  const zipPath = path.join(caseDir, `${projectName}.zip`)
  const config = {
    project_name: projectName,
    ...options,
  }
  await previewDetails(config)
  await generateZip(zipPath, config)

  console.log(`==> ${name}: extract`)
  await run('python3', ['-m', 'zipfile', '-e', zipPath, caseDir], { cwd: repoRoot })
  const projectRoot = await findProjectRoot(caseDir)
  await access(path.join(projectRoot, 'README.md'))

  console.log(`==> ${name}: install`)
  await runShell(installCommand, projectRoot)

  console.log(`==> ${name}: build`)
  await runShell(buildCommand, projectRoot)
}

async function ensureBackend() {
  if (await ready()) {
    return
  }

  backend = spawn('cargo', ['run', '--manifest-path', 'apps/api/Cargo.toml', '--locked'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SCAFFOLDER_TEMPLATE_ROOT: path.join(repoRoot, 'apps/api/templates'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  backend.stdout.on('data', (chunk) => process.stdout.write(`[api] ${chunk}`))
  backend.stderr.on('data', (chunk) => process.stderr.write(`[api] ${chunk}`))

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await ready()) {
      return
    }
    await sleep(500)
  }

  throw new Error(`Backend did not become ready at ${baseUrl}/ready`)
}

async function ready() {
  try {
    const response = await fetch(`${baseUrl}/ready`)
    return response.ok
  } catch {
    return false
  }
}

async function generateZip(zipPath, config) {
  const response = await fetch(`${baseUrl}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  })

  if (!response.ok) {
    throw new Error(`Generate failed with ${response.status}: ${await response.text()}`)
  }

  await new Promise((resolve, reject) => {
    const file = createWriteStream(zipPath)
    file.on('finish', resolve)
    file.on('error', reject)
    response.body.pipeTo(Writable.toWeb(file)).catch(reject)
  })
}

async function previewDetails(config) {
  const response = await fetch(`${baseUrl}/preview/details`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  })

  if (!response.ok) {
    throw new Error(`Preview details failed with ${response.status}: ${await response.text()}`)
  }

  const details = await response.json()
  const readme = details.files?.find((file) => file.path === 'README.md')
  const packageJson = details.files?.find((file) => file.path === 'package.json')
  if (!details.tree || !readme || !packageJson || !details.commands?.length) {
    throw new Error('Preview details response is missing tree, README, package.json, or commands')
  }
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url} with ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

async function findProjectRoot(caseDir) {
  const entries = await readdir(caseDir, { withFileTypes: true })
  const dirs = entries.filter((entry) => entry.isDirectory())

  for (const dir of dirs) {
    const candidate = path.join(caseDir, dir.name)
    try {
      await access(path.join(candidate, 'package.json'))
      return candidate
    } catch {
      // Keep looking.
    }
  }

  throw new Error(`No generated package.json found under ${caseDir}`)
}

async function runShell(command, cwd) {
  const [cmd, ...args] = command.split(' ').filter(Boolean)
  await run(cmd, args, { cwd })
}

async function run(cmd, args, options) {
  await new Promise((resolve, reject) => {
    const child = execFile(cmd, args, {
      ...options,
      env: {
        ...process.env,
        CI: '1',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    })

    child.stdout?.on('data', (chunk) => process.stdout.write(chunk))
    child.stderr?.on('data', (chunk) => process.stderr.write(chunk))
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))
      }
    })
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
