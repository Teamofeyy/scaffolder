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
  return version
}

async function updateDependencyMap(dependencies) {
  if (!dependencies) return

  for (const packageName of Object.keys(dependencies)) {
    const current = dependencies[packageName]
    const prefix = current.startsWith('~') ? '~' : '^'
    dependencies[packageName] = `${prefix}${await latestVersion(packageName)}`
  }
}

for (const preset of Object.values(manifest)) {
  await updateDependencyMap(preset.dependencies)
  await updateDependencyMap(preset.devDependencies)
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Updated ${manifestPath}`)
