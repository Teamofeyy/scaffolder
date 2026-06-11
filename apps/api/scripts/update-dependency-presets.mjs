import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifestPath = path.resolve(__dirname, '../api/dependency-presets.json')

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const versionCache = new Map()

async function latestVersion(packageName) {
  if (versionCache.has(packageName)) return versionCache.get(packageName)

  const encoded = packageName.startsWith('@')
    ? `@${packageName.slice(1).replace('/', '%2f')}`
    : encodeURIComponent(packageName)
  const response = await fetch(`https://registry.npmjs.org/${encoded}`)
  if (!response.ok) {
    throw new Error(`npm registry returned ${response.status} for ${packageName}`)
  }

  const metadata = await response.json()
  const version = metadata?.['dist-tags']?.latest
  if (!version) {
    throw new Error(`npm registry response has no latest dist-tag for ${packageName}`)
  }

  versionCache.set(packageName, version)
  return { version, versions: Object.keys(metadata?.versions ?? {}) }
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) return null

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: version,
  }
}

function currentMajor(range) {
  const match = range.replace(/^[~^]/, '').match(/^(\d+)\./)
  return match ? Number(match[1]) : undefined
}

function newestSameMajor(versions, major) {
  return versions
    .map(parseVersion)
    .filter((version) => version && version.major === major)
    .sort((left, right) => {
      if (left.major !== right.major) return right.major - left.major
      if (left.minor !== right.minor) return right.minor - left.minor
      return right.patch - left.patch
    })[0]?.raw
}

async function updateDependencyMap(dependencies) {
  if (!dependencies) return

  for (const packageName of Object.keys(dependencies)) {
    const current = dependencies[packageName]
    const prefix = current.startsWith('~') ? '~' : '^'
    const metadata = await latestVersion(packageName)
    const major = currentMajor(current)
    const nextVersion = major === undefined
      ? metadata.version
      : newestSameMajor(metadata.versions, major) ?? metadata.version

    dependencies[packageName] = `${prefix}${nextVersion}`
  }
}

for (const preset of Object.values(manifest)) {
  await updateDependencyMap(preset.dependencies)
  await updateDependencyMap(preset.devDependencies)
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Updated ${manifestPath}`)
