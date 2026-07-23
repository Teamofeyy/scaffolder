import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const recipeRoot = path.join(repoRoot, 'recipes')

const roots = {
  baseTemplates: path.join(recipeRoot, 'base-templates'),
  blocks: path.join(recipeRoot, 'blocks'),
  recipes: path.join(recipeRoot, 'catalog'),
}

const errors = []

const baseTemplates = await loadManifests(roots.baseTemplates)
const blocks = await loadManifests(roots.blocks)
const recipes = await loadManifests(roots.recipes)

const baseTemplateById = indexById(baseTemplates, 'base template')
const blockById = indexById(blocks, 'block')
const recipeById = indexById(recipes, 'recipe')

for (const manifest of baseTemplates) {
  await validateBaseTemplate(manifest)
}

for (const manifest of blocks) {
  await validateBlock(manifest)
}

for (const manifest of recipes) {
  await validateRecipe(manifest)
}

if (errors.length > 0) {
  console.error(`Recipe verification failed with ${errors.length} error(s):`)
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(
  `Recipe manifests verified: ${baseTemplateById.size} base template(s), ` +
    `${blockById.size} block(s), ${recipeById.size} recipe(s)`,
)

async function loadManifests(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()

  const manifests = []
  for (const file of files) {
    const filePath = path.join(dir, file)
    const relativePath = path.relative(repoRoot, filePath)
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw)
      parsed.__file = relativePath
      manifests.push(parsed)
    } catch (error) {
      fail(relativePath, `invalid JSON: ${error.message}`)
    }
  }

  return manifests
}

function indexById(manifests, kind) {
  const map = new Map()
  for (const manifest of manifests) {
    const context = manifest.__file ?? kind
    if (!isObject(manifest)) {
      fail(context, 'manifest root must be an object')
      continue
    }
    if (!isSlug(manifest.id)) {
      fail(context, `${kind} id must be a kebab-case slug`)
      continue
    }
    if (map.has(manifest.id)) {
      fail(context, `duplicate ${kind} id "${manifest.id}"`)
      continue
    }
    map.set(manifest.id, manifest)
  }
  return map
}

async function validateBaseTemplate(manifest) {
  const context = manifest.__file
  requireKeys(
    manifest,
    ['$schema', 'id', 'name', 'description', 'status', 'snapshotPath', 'source', 'provides'],
    context,
  )
  exactKeys(
    manifest,
    ['$schema', 'id', 'name', 'description', 'status', 'snapshotPath', 'source', 'provides', '__file'],
    context,
  )

  requireSlug(manifest.id, context, 'id')
  requireString(manifest.name, context, 'name')
  requireString(manifest.description, context, 'description')
  requireEnum(manifest.status, ['candidate', 'verified', 'promoted'], context, 'status')
  requireString(manifest.snapshotPath, context, 'snapshotPath')
  await validateSchemaReference(manifest, context)

  exactObjectKeys(manifest.source, ['kind', 'repository', 'ref', 'path'], context, 'source')
  requireEnum(manifest.source?.kind, ['github', 'submodule'], context, 'source.kind')
  requireString(manifest.source?.repository, context, 'source.repository')
  requireString(manifest.source?.ref, context, 'source.ref')
  requireString(manifest.source?.path, context, 'source.path')

  validateCapabilitiesObject(manifest.provides, context, 'provides')

  if (typeof manifest.snapshotPath === 'string') {
    try {
      await access(path.join(repoRoot, manifest.snapshotPath))
    } catch {
      fail(context, `snapshotPath does not exist: ${manifest.snapshotPath}`)
    }
  }
}

async function validateBlock(manifest) {
  const context = manifest.__file
  requireKeys(
    manifest,
    [
      '$schema',
      'id',
      'name',
      'description',
      'category',
      'status',
      'requires',
      'conflicts',
      'provides',
      'filesTouched',
      'operations',
    ],
    context,
  )
  exactKeys(
    manifest,
    [
      '$schema',
      'id',
      'name',
      'description',
      'category',
      'status',
      'requires',
      'conflicts',
      'provides',
      'filesTouched',
      'operations',
      '__file',
    ],
    context,
  )

  requireSlug(manifest.id, context, 'id')
  requireString(manifest.name, context, 'name')
  requireString(manifest.description, context, 'description')
  requireEnum(manifest.category, ['integration', 'starter'], context, 'category')
  requireEnum(manifest.status, ['draft', 'experimental', 'stable', 'deprecated'], context, 'status')
  await validateSchemaReference(manifest, context)

  validateRequires(manifest.requires, context)
  validateConflicts(manifest.conflicts, context)
  validateCapabilitiesObject(manifest.provides, context, 'provides')
  requireStringArray(manifest.filesTouched, context, 'filesTouched')
  await validateOperations(manifest.operations, manifest.filesTouched, context)

  for (const baseTemplateId of manifest.requires?.baseTemplates ?? []) {
    if (!baseTemplateById.has(baseTemplateId)) {
      fail(context, `requires unknown base template "${baseTemplateId}"`)
    }
  }
  for (const blockId of manifest.requires?.blocks ?? []) {
    if (!blockById.has(blockId)) {
      fail(context, `requires unknown block "${blockId}"`)
    }
  }
  for (const blockId of manifest.conflicts?.blocks ?? []) {
    if (!blockById.has(blockId)) {
      fail(context, `conflicts with unknown block "${blockId}"`)
    }
  }
}

async function validateRecipe(manifest) {
  const context = manifest.__file
  requireKeys(
    manifest,
    [
      '$schema',
      'id',
      'name',
      'description',
      'tier',
      'status',
      'baseTemplate',
      'blocks',
      'options',
      'customDependencies',
      'verification',
      'preview',
    ],
    context,
  )
  exactKeys(
    manifest,
    [
      '$schema',
      'id',
      'name',
      'description',
      'tier',
      'status',
      'baseTemplate',
      'blocks',
      'options',
      'customDependencies',
      'verification',
      'preview',
      '__file',
    ],
    context,
  )

  requireSlug(manifest.id, context, 'id')
  requireString(manifest.name, context, 'name')
  requireString(manifest.description, context, 'description')
  requireEnum(manifest.tier, ['recommended', 'community', 'experimental', 'deprecated'], context, 'tier')
  requireEnum(manifest.status, ['draft', 'active', 'deprecated'], context, 'status')
  await validateSchemaReference(manifest, context)
  requireSlug(manifest.baseTemplate, context, 'baseTemplate')
  if (!baseTemplateById.has(manifest.baseTemplate)) {
    fail(context, `references unknown base template "${manifest.baseTemplate}"`)
  }

  requireStringArray(manifest.blocks, context, 'blocks')
  for (const blockId of manifest.blocks ?? []) {
    if (!blockById.has(blockId)) {
      fail(context, `references unknown block "${blockId}"`)
    }
  }

  validateOptions(manifest.options, context)
  validateCustomDependencies(manifest.customDependencies, context)
  validateVerification(manifest.verification, context)
  validatePreview(manifest.preview, context)
  validateRecipeCompatibility(manifest, context)
  validateRecommendedPromotionMetadata(manifest, context)
}

function validateOptions(options, context) {
  if (!isObject(options)) {
    fail(context, 'options must be an object')
    return
  }

  for (const [optionId, option] of Object.entries(options)) {
    const optionContext = `${context} option "${optionId}"`
    if (!isSlug(optionId)) {
      fail(context, `option id must be a kebab-case slug: ${optionId}`)
    }
    requireKeys(option, ['label', 'description', 'default', 'values'], optionContext)
    exactKeys(option, ['label', 'description', 'default', 'values'], optionContext)
    requireString(option.label, optionContext, 'label')
    requireString(option.description, optionContext, 'description')
    requireSlug(option.default, optionContext, 'default')

    if (!Array.isArray(option.values) || option.values.length === 0) {
      fail(optionContext, 'values must be a non-empty array')
      continue
    }

    const valueIds = new Set()
    for (const value of option.values) {
      const valueContext = `${optionContext} value`
      requireKeys(value, ['id', 'label', 'description', 'blocks'], valueContext)
      exactKeys(value, ['id', 'label', 'description', 'blocks'], valueContext)
      requireSlug(value.id, valueContext, 'id')
      requireString(value.label, valueContext, 'label')
      requireString(value.description, valueContext, 'description')
      requireStringArray(value.blocks, valueContext, 'blocks')
      if (valueIds.has(value.id)) {
        fail(optionContext, `duplicate value "${value.id}"`)
      }
      valueIds.add(value.id)
      for (const blockId of value.blocks ?? []) {
        if (!blockById.has(blockId)) {
          fail(optionContext, `value "${value.id}" references unknown block "${blockId}"`)
        }
      }
    }
    if (!valueIds.has(option.default)) {
      fail(optionContext, `default value "${option.default}" is not declared`)
    }
  }
}

async function validateSchemaReference(manifest, context) {
  requireString(manifest.$schema, context, '$schema')
  if (typeof manifest.$schema !== 'string') {
    return
  }

  const schemaPath = path.resolve(repoRoot, path.dirname(context), manifest.$schema)
  try {
    await access(schemaPath)
  } catch {
    fail(context, `$schema does not exist: ${manifest.$schema}`)
  }
}

function validateCustomDependencies(customDependencies, context) {
  exactObjectKeys(customDependencies, ['allow', 'policy'], context, 'customDependencies')
  if (typeof customDependencies?.allow !== 'boolean') {
    fail(context, 'customDependencies.allow must be a boolean')
  }
  requireEnum(customDependencies?.policy, ['package-json-only'], context, 'customDependencies.policy')
}

function validateVerification(verification, context) {
  exactObjectKeys(verification, ['generate', 'install', 'build', 'test'], context, 'verification')
  for (const key of ['generate', 'install', 'build']) {
    if (typeof verification?.[key] !== 'boolean') {
      fail(context, `verification.${key} must be a boolean`)
    }
  }
  requireEnum(verification?.test, ['none', 'optional', 'required'], context, 'verification.test')
}

function validatePreview(preview, context) {
  exactObjectKeys(preview, ['curatedFiles', 'showAllFiles'], context, 'preview')
  requireStringArray(preview?.curatedFiles, context, 'preview.curatedFiles')
  if (typeof preview?.showAllFiles !== 'boolean') {
    fail(context, 'preview.showAllFiles must be a boolean')
  }
}

function validateRecipeCompatibility(recipe, context) {
  const optionValues = Object.values(recipe.options ?? {}).flatMap((option) => option.values ?? [])
  const selections = [
    { name: 'base blocks', blocks: recipe.blocks ?? [] },
    ...optionValues.map((value) => ({
      name: `option value "${value.id}"`,
      blocks: [...(recipe.blocks ?? []), ...(value.blocks ?? [])],
    })),
  ]

  for (const selection of selections) {
    const selected = new Set(selection.blocks)
    const capabilities = capabilitiesForSelection(recipe.baseTemplate, selected)
    for (const blockId of selected) {
      const block = blockById.get(blockId)
      if (!block) continue

      const allowedBaseTemplates = block.requires?.baseTemplates ?? []
      if (allowedBaseTemplates.length > 0 && !allowedBaseTemplates.includes(recipe.baseTemplate)) {
        fail(
          context,
          `${selection.name} includes "${blockId}" but it does not support base template "${recipe.baseTemplate}"`,
        )
      }

      for (const requiredBlock of block.requires?.blocks ?? []) {
        if (!selected.has(requiredBlock)) {
          fail(context, `${selection.name} includes "${blockId}" without required block "${requiredBlock}"`)
        }
      }

      for (const requiredCapability of block.requires?.capabilities ?? []) {
        if (!capabilities.has(requiredCapability)) {
          fail(context, `${selection.name} includes "${blockId}" without capability "${requiredCapability}"`)
        }
      }

      for (const conflictingBlock of block.conflicts?.blocks ?? []) {
        if (selected.has(conflictingBlock)) {
          fail(context, `${selection.name} includes conflicting blocks "${blockId}" and "${conflictingBlock}"`)
        }
      }

      for (const conflictingCapability of block.conflicts?.capabilities ?? []) {
        if (capabilities.has(conflictingCapability)) {
          fail(context, `${selection.name} includes "${blockId}" with conflicting capability "${conflictingCapability}"`)
        }
      }
    }
  }
}

function validateRecommendedPromotionMetadata(recipe, context) {
  if (recipe.tier !== 'recommended') {
    return
  }

  if (recipe.status !== 'active') {
    fail(context, 'recommended recipes must have status "active"')
  }

  for (const key of ['generate', 'install', 'build']) {
    if (recipe.verification?.[key] !== true) {
      fail(context, `recommended recipes must set verification.${key} to true`)
    }
  }

  const baseTemplate = baseTemplateById.get(recipe.baseTemplate)
  if (baseTemplate && !['verified', 'promoted'].includes(baseTemplate.status)) {
    fail(context, `recommended recipes must use a verified or promoted base template, got "${baseTemplate.status}"`)
  }

  const selectedBlockIds = new Set(recipe.blocks ?? [])
  for (const option of Object.values(recipe.options ?? {})) {
    for (const value of option.values ?? []) {
      for (const blockId of value.blocks ?? []) {
        selectedBlockIds.add(blockId)
      }
    }
  }

  for (const blockId of selectedBlockIds) {
    const block = blockById.get(blockId)
    if (block && block.status !== 'stable') {
      fail(context, `recommended recipes must use stable blocks only, got "${blockId}" with status "${block.status}"`)
    }
  }

  for (const requiredPreviewFile of ['package.json', 'README.md']) {
    if (!recipe.preview?.curatedFiles?.includes(requiredPreviewFile)) {
      fail(context, `recommended recipes must include ${requiredPreviewFile} in preview.curatedFiles`)
    }
  }
}

function capabilitiesForSelection(baseTemplateId, selectedBlocks) {
  const capabilities = new Set(baseTemplateById.get(baseTemplateId)?.provides?.capabilities ?? [])
  for (const blockId of selectedBlocks) {
    for (const capability of blockById.get(blockId)?.provides?.capabilities ?? []) {
      capabilities.add(capability)
    }
  }
  return capabilities
}

function validateRequires(value, context) {
  exactObjectKeys(value, ['baseTemplates', 'blocks', 'capabilities'], context, 'requires')
  requireStringArray(value?.baseTemplates, context, 'requires.baseTemplates')
  requireStringArray(value?.blocks, context, 'requires.blocks')
  requireStringArray(value?.capabilities, context, 'requires.capabilities')
}

function validateConflicts(value, context) {
  exactObjectKeys(value, ['blocks', 'capabilities'], context, 'conflicts')
  requireStringArray(value?.blocks, context, 'conflicts.blocks')
  requireStringArray(value?.capabilities, context, 'conflicts.capabilities')
}

function validateCapabilitiesObject(value, context, field) {
  exactObjectKeys(value, ['capabilities'], context, field)
  requireStringArray(value?.capabilities, context, `${field}.capabilities`)
}

async function validateOperations(operations, filesTouched, context) {
  if (!Array.isArray(operations)) {
    fail(context, 'operations must be an array')
    return
  }

  const allowedTypes = [
    'package-json-merge',
    'tsconfig-merge',
    'components-json-merge',
    'css-append',
    'file-template',
    'file-copy',
    'text-patch',
  ]

  for (const operation of operations) {
    const operationContext = `${context} operation`
    exactKeys(operation, ['type', 'target', 'description', 'template'], operationContext)
    requireEnum(operation?.type, allowedTypes, operationContext, 'type')
    requireString(operation?.target, operationContext, 'target')
    requireString(operation?.description, operationContext, 'description')
    if (operation?.template !== undefined) {
      requireString(operation.template, operationContext, 'template')
    }
    if (typeof operation?.target === 'string' && !filesTouched?.includes(operation.target)) {
      fail(context, `operation target "${operation.target}" is not listed in filesTouched`)
    }
    if (operation?.type === 'file-template' && !operation.template) {
      fail(operationContext, 'file-template operations must declare template')
    }
    if (operation?.template !== undefined) {
      const templatePath = path.join(recipeRoot, 'templates', operation.template)
      try {
        await access(templatePath)
      } catch {
        fail(operationContext, `template does not exist: ${operation.template}`)
      }
    }
  }
}

function requireKeys(value, keys, context) {
  if (!isObject(value)) {
    fail(context, 'must be an object')
    return
  }
  for (const key of keys) {
    if (!(key in value)) {
      fail(context, `missing required field "${key}"`)
    }
  }
}

function exactObjectKeys(value, allowed, context, field) {
  if (!isObject(value)) {
    fail(context, `${field} must be an object`)
    return
  }
  exactKeys(value, allowed, `${context} ${field}`)
}

function exactKeys(value, allowed, context) {
  if (!isObject(value)) return
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      fail(context, `unknown field "${key}"`)
    }
  }
}

function requireString(value, context, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(context, `${field} must be a non-empty string`)
  }
}

function requireSlug(value, context, field) {
  if (!isSlug(value)) {
    fail(context, `${field} must be a kebab-case slug`)
  }
}

function requireEnum(value, allowed, context, field) {
  if (!allowed.includes(value)) {
    fail(context, `${field} must be one of: ${allowed.join(', ')}`)
  }
}

function requireStringArray(value, context, field) {
  if (!Array.isArray(value)) {
    fail(context, `${field} must be an array`)
    return
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      fail(context, `${field} entries must be non-empty strings`)
    }
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSlug(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)
}

function fail(context, message) {
  errors.push(`${context}: ${message}`)
}
