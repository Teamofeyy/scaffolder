'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import {
  CheckCircle2,
  Download,
  FileCode2,
  FlaskConical,
  FolderTree,
  Package,
  Search,
  Settings2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  downloadFile,
  generateRecipe,
  getRecipe,
  getRecipes,
  previewRecipe,
  validateRecipeProjectName,
  type PreviewFile,
  type RecipeCatalogItem,
  type RecipeManifest,
  type RecipePreviewDetails,
  type RecipeProjectRequest,
  type SupportStatus,
} from '@/lib/api'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { cn } from '@/lib/utils'
import { FileTree } from './file-tree'

type CatalogTab = 'recommended' | 'community'
type DependencyBucket = 'dependencies' | 'devDependencies'

interface RecipeWorkbenchProps {
  dictionary: Dictionary['workbench']
  errors: Dictionary['errors']
}

export function RecipeWorkbench({ dictionary, errors }: RecipeWorkbenchProps) {
  const [recipes, setRecipes] = useState<RecipeCatalogItem[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('recommended')
  const [query, setQuery] = useState('')
  const [showExperimental, setShowExperimental] = useState(true)
  const [isCatalogExpanded, setIsCatalogExpanded] = useState(false)

  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<RecipeManifest | null>(null)
  const [projectName, setProjectName] = useState('my-react-app')
  const [options, setOptions] = useState<Record<string, string>>({})
  const [dependencies, setDependencies] = useState<string[]>([])
  const [devDependencies, setDevDependencies] = useState<string[]>([])
  const [dependencyInput, setDependencyInput] = useState('')
  const [devDependencyInput, setDevDependencyInput] = useState('')
  const [showAllFiles, setShowAllFiles] = useState(false)

  const [preview, setPreview] = useState<RecipePreviewDetails | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false

    getRecipes()
      .then((items) => {
        if (cancelled) return
        setRecipes(items)
        const hasRecommended = items.some(
          (item) => item.tier === 'recommended' || item.tier === 'official',
        )
        const hasCommunity = items.some(
          (item) => item.tier !== 'recommended' && item.tier !== 'official',
        )
        if (!hasRecommended && hasCommunity) setCatalogTab('community')
      })
      .catch(() => {
        if (!cancelled) setCatalogError(dictionary.catalogUnavailable)
      })
      .finally(() => {
        if (!cancelled) setIsCatalogLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [dictionary.catalogUnavailable])

  useEffect(() => {
    if (!selectedRecipeId) return

    let cancelled = false
    setRecipe(null)
    setPreview(null)
    setSelectedFilePath(null)
    setPreviewError(null)

    getRecipe(selectedRecipeId)
      .then((details) => {
        if (cancelled) return
        setRecipe(details)
        setOptions(defaultOptions(details))
        setShowAllFiles(false)
      })
      .catch((error) => {
        if (!cancelled)
          setPreviewError(
            error instanceof Error
              ? error.message
              : dictionary.recipeUnavailable,
          )
      })

    return () => {
      cancelled = true
    }
  }, [selectedRecipeId, dictionary.recipeUnavailable])

  const request = useMemo<RecipeProjectRequest | null>(() => {
    if (!recipe) return null

    return {
      projectName: projectName.trim() || 'my-react-app',
      options,
      extras: {
        dependencies,
        devDependencies,
      },
    }
  }, [dependencies, devDependencies, options, projectName, recipe])

  useEffect(() => {
    if (!selectedRecipeId || !request) return

    const validation = validateRecipeProjectName(request.projectName, errors)
    if (!validation.valid) {
      setPreviewError(validation.error ?? dictionary.previewUnavailable)
      return
    }

    let cancelled = false
    setIsPreviewLoading(true)
    setPreviewError(null)

    const timeoutId = window.setTimeout(() => {
      previewRecipe(selectedRecipeId, request)
        .then((nextPreview) => {
          if (cancelled) return
          setPreview(nextPreview)
          const firstFile = nextPreview.selectedFiles[0] ?? nextPreview.files[0]
          setSelectedFilePath((current) => {
            if (current && findPreviewFile(nextPreview, current)) return current
            return firstFile?.path ?? null
          })
        })
        .catch((error) => {
          if (!cancelled)
            setPreviewError(
              error instanceof Error
                ? error.message
                : dictionary.previewUnavailable,
            )
        })
        .finally(() => {
          if (!cancelled) setIsPreviewLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [selectedRecipeId, request, errors, dictionary.previewUnavailable])

  const visibleRecipes = recipes.filter((item) => {
    const normalizedQuery = query.trim().toLowerCase()
    const matchesQuery =
      normalizedQuery.length === 0 ||
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.description.toLowerCase().includes(normalizedQuery) ||
      item.id.toLowerCase().includes(normalizedQuery)
    const isRecommended =
      item.tier === 'recommended' || item.tier === 'official'
    const matchesTab =
      catalogTab === 'recommended' ? isRecommended : !isRecommended
    const matchesExperimental =
      showExperimental ||
      (item.status !== 'draft' && item.tier !== 'experimental')

    return matchesQuery && matchesTab && matchesExperimental
  })

  const selectedFile =
    preview && selectedFilePath
      ? findPreviewFile(preview, selectedFilePath)
      : undefined
  const tree = preview
    ? showAllFiles
      ? preview.tree
      : preview.curatedTree
    : null
  const selectedRecipe =
    recipe ?? recipes.find((item) => item.id === selectedRecipeId) ?? null
  const catalogCounts = {
    recommended: recipes.filter(
      (item) => item.tier === 'recommended' || item.tier === 'official',
    ).length,
    community: recipes.filter(
      (item) => item.tier !== 'recommended' && item.tier !== 'official',
    ).length,
  }

  const selectRecipe = (item: RecipeCatalogItem) => {
    setSelectedRecipeId(item.id)
    setIsCatalogExpanded(false)
    setProjectName(defaultProjectName(item.id))
    setDependencies([])
    setDevDependencies([])
    setDependencyInput('')
    setDevDependencyInput('')
  }

  const updateOption = (key: string, value: string) => {
    setOptions((current) => ({ ...current, [key]: value }))
  }

  const addDependency = (bucket: DependencyBucket) => {
    const input =
      bucket === 'dependencies' ? dependencyInput : devDependencyInput
    const nextItems = parseDependencyInput(input)
    if (nextItems.length === 0) return

    if (bucket === 'dependencies') {
      setDependencies((current) => mergeDependencies(current, nextItems))
      setDependencyInput('')
    } else {
      setDevDependencies((current) => mergeDependencies(current, nextItems))
      setDevDependencyInput('')
    }
  }

  const removeDependency = (bucket: DependencyBucket, dependency: string) => {
    if (bucket === 'dependencies') {
      setDependencies((current) =>
        current.filter((item) => item !== dependency),
      )
    } else {
      setDevDependencies((current) =>
        current.filter((item) => item !== dependency),
      )
    }
  }

  const handleGenerate = async () => {
    if (!selectedRecipeId || !request) return

    const validation = validateRecipeProjectName(request.projectName, errors)
    if (!validation.valid) {
      toast.error(dictionary.validationTitle, {
        description: validation.error ?? dictionary.validationFallback,
      })
      return
    }

    setIsGenerating(true)
    try {
      const zip = await generateRecipe(selectedRecipeId, request)
      const filename = `${request.projectName}.zip`
      downloadFile(zip, filename)
      toast.success(dictionary.generatedTitle, {
        description: dictionary.generatedDescription.replace(
          '{filename}',
          filename,
        ),
      })
    } catch (error) {
      toast.error(dictionary.generateFailed, {
        description:
          error instanceof Error
            ? error.message
            : dictionary.previewUnavailable,
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const showFullCatalog = !selectedRecipe || isCatalogExpanded

  return (
    <main className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-4 py-3 md:px-5">
      <section className="border-b border-border pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">
              {dictionary.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
              {dictionary.description}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={dictionary.searchPlaceholder}
                className="pl-9"
              />
            </div>
            <label className="flex h-9 items-center justify-between gap-3 rounded-md border border-border px-3 text-sm">
              <span className="whitespace-nowrap">
                {dictionary.showExperimental}
              </span>
              <Switch
                checked={showExperimental}
                onCheckedChange={setShowExperimental}
              />
            </label>
          </div>
        </div>
      </section>

      {showFullCatalog ? (
        <section className="space-y-2" aria-label={dictionary.catalogLabel}>
          <div
            className="inline-flex h-9 w-full items-center rounded-md bg-muted p-1 text-muted-foreground sm:w-fit"
            role="tablist"
            aria-label={dictionary.catalogLabel}
          >
            <button
              type="button"
              role="tab"
              aria-selected={catalogTab === 'recommended'}
              className={cn(
                'h-7 min-w-32 rounded-sm px-3 text-sm font-medium transition-colors',
                catalogTab === 'recommended' &&
                  'bg-background text-foreground shadow-sm',
              )}
              onClick={() => setCatalogTab('recommended')}
            >
              {dictionary.recommended} ({catalogCounts.recommended})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={catalogTab === 'community'}
              className={cn(
                'h-7 min-w-32 rounded-sm px-3 text-sm font-medium transition-colors',
                catalogTab === 'community' &&
                  'bg-background text-foreground shadow-sm',
              )}
              onClick={() => setCatalogTab('community')}
            >
              {dictionary.community} ({catalogCounts.community})
            </button>
          </div>

          {catalogError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {catalogError}
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleRecipes.map((item) => (
              <RecipeCard
                key={item.id}
                recipe={item}
                selected={item.id === selectedRecipeId}
                dictionary={dictionary}
                onSelect={() => selectRecipe(item)}
              />
            ))}
          </div>

          {!isCatalogLoading && visibleRecipes.length === 0 && (
            <p className="rounded-md border border-border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
              {dictionary.emptyCatalog}
            </p>
          )}
          {isCatalogLoading && (
            <p className="rounded-md border border-border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
              {dictionary.loadingCatalog}
            </p>
          )}
        </section>
      ) : (
        <section
          className="rounded-md border border-border bg-background px-3 py-2"
          aria-label={dictionary.catalogLabel}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-sm font-semibold">
                {selectedRecipe.name}
              </span>
              <StatusBadge
                status={selectedRecipe.tier}
                label={selectedRecipe.tier}
              />
              <StatusBadge
                status={selectedRecipe.status}
                label={selectedRecipe.status}
              />
              <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                {selectedRecipe.baseTemplate}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIsCatalogExpanded(true)}
            >
              {dictionary.catalogLabel}
            </Button>
          </div>
        </section>
      )}

      {selectedRecipe ? (
        <section
          className="grid min-h-0 gap-3 xl:h-[calc(100vh-225px)] xl:min-h-[680px] xl:grid-cols-[300px_minmax(0,1fr)_320px]"
          aria-label={dictionary.workspaceLabel}
        >
          <aside className="flex min-h-0 min-w-0 flex-col rounded-md border border-border bg-background">
            <div className="shrink-0 border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">{dictionary.optionsTitle}</h2>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {selectedRecipe.name}
              </p>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-3">
                <div className="space-y-2">
                  <Label htmlFor="recipe-project-name">
                    {dictionary.projectName}
                  </Label>
                  <Input
                    id="recipe-project-name"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="my-react-app"
                  />
                </div>

                {recipe ? (
                  Object.entries(recipe.options).map(([key, option]) => (
                    <div key={key} className="space-y-2">
                      <div>
                        <Label>{option.label}</Label>
                        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                      <div
                        className="grid gap-2"
                        role="radiogroup"
                        aria-label={option.label}
                      >
                        {option.values.map((value) => {
                          const selected = options[key] === value.id
                          return (
                            <button
                              key={value.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              className={cn(
                                'rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                selected
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border bg-background hover:bg-accent/50',
                              )}
                              onClick={() => updateOption(key, value.id)}
                            >
                              <span className="block text-sm font-medium">
                                {value.label}
                              </span>
                              <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                                {value.description}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {dictionary.loadingRecipe}
                  </p>
                )}

                {recipe?.customDependencies.allow && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <DependencyEditor
                      title={dictionary.dependencies}
                      placeholder={dictionary.dependenciesPlaceholder}
                      value={dependencyInput}
                      items={dependencies}
                      addLabel={dictionary.addDependency}
                      onValueChange={setDependencyInput}
                      onAdd={() => addDependency('dependencies')}
                      onRemove={(dependency) =>
                        removeDependency('dependencies', dependency)
                      }
                    />
                    <DependencyEditor
                      title={dictionary.devDependencies}
                      placeholder={dictionary.devDependenciesPlaceholder}
                      value={devDependencyInput}
                      items={devDependencies}
                      addLabel={dictionary.addDependency}
                      onValueChange={setDevDependencyInput}
                      onAdd={() => addDependency('devDependencies')}
                      onRemove={(dependency) =>
                        removeDependency('devDependencies', dependency)
                      }
                    />
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border bg-background">
            <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">{dictionary.filesTitle}</h2>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {preview
                    ? preview.templateSnapshot
                    : dictionary.previewPending}
                </p>
              </div>
              <label className="flex h-9 items-center justify-between gap-3 rounded-md border border-border px-3 text-sm">
                <span>{dictionary.showAllFiles}</span>
                <Switch
                  checked={showAllFiles}
                  onCheckedChange={setShowAllFiles}
                />
              </label>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="min-h-0 border-b border-border lg:border-b-0 lg:border-r">
                <ScrollArea className="h-[300px] lg:h-full">
                  <div className="p-3">
                    {tree ? (
                      <FileTree
                        data={tree}
                        selectedPath={selectedFilePath}
                        onSelectFile={setSelectedFilePath}
                      />
                    ) : (
                      <p className="px-2 py-8 text-sm text-muted-foreground">
                        {isPreviewLoading
                          ? dictionary.loadingPreview
                          : (previewError ?? dictionary.previewPending)}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex min-h-0 min-w-0 flex-col">
                <div className="flex min-h-10 shrink-0 items-center gap-2 border-b border-border px-3">
                  <FileCode2 className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 truncate font-mono text-sm">
                    {selectedFilePath ?? dictionary.noFileSelected}
                  </span>
                </div>
                <ScrollArea className="h-[520px] min-h-0 flex-1 lg:h-auto">
                  {selectedFile ? (
                    <pre className="min-w-0 overflow-x-auto p-3 text-xs leading-5">
                      <code>{selectedFile.content}</code>
                    </pre>
                  ) : (
                    <div className="p-4 text-sm leading-6 text-muted-foreground">
                      {selectedFilePath
                        ? dictionary.fileContentUnavailable
                        : isPreviewLoading
                          ? dictionary.loadingPreview
                          : (previewError ?? dictionary.noFileSelected)}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </section>

          <aside className="flex min-h-0 min-w-0 flex-col rounded-md border border-border bg-background">
            <div className="shrink-0 border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">{dictionary.summaryTitle}</h2>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">
                {selectedRecipe.description}
              </p>
            </div>
            <div className="shrink-0 space-y-3 border-b border-border p-3">
              <Button
                className="w-full"
                size="lg"
                onClick={handleGenerate}
                disabled={!preview || isGenerating || Boolean(previewError)}
              >
                <Download className="h-4 w-4" />
                {isGenerating ? dictionary.generating : dictionary.generateZip}
              </Button>
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  status={selectedRecipe.tier}
                  label={selectedRecipe.tier}
                />
                <StatusBadge
                  status={selectedRecipe.status}
                  label={selectedRecipe.status}
                />
                {preview && (
                  <StatusBadge
                    status={preview.supportStatus}
                    label={preview.supportStatus}
                  />
                )}
              </div>

              <VerificationSummary
                verification={
                  preview?.verification ?? selectedRecipe.verification
                }
                dictionary={dictionary}
              />
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-3 p-3">
                <SummaryList
                  title={dictionary.commands}
                  items={preview?.commands ?? []}
                  mono
                />
                <SummaryList
                  title="dependencies"
                  items={preview?.dependencies ?? []}
                  mono
                />
                <SummaryList
                  title="devDependencies"
                  items={preview?.devDependencies ?? []}
                  mono
                />
                <SummaryList
                  title={dictionary.selectedBlocks}
                  items={preview?.selectedBlocks ?? []}
                  mono
                />

                {preview?.warnings.length ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      {dictionary.warnings}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-900 dark:text-amber-100">
                      {preview.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {previewError && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {previewError}
                  </p>
                )}
              </div>
            </ScrollArea>
          </aside>
        </section>
      ) : (
        <section className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {dictionary.selectRecipePrompt}
          </p>
        </section>
      )}
    </main>
  )
}

function RecipeCard({
  recipe,
  selected,
  dictionary,
  onSelect,
}: {
  recipe: RecipeCatalogItem
  selected: boolean
  dictionary: Dictionary['workbench']
  onSelect: () => void
}) {
  return (
    <Card className={cn('gap-2 py-3', selected && 'border-primary')}>
      <CardHeader className="px-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{recipe.name}</CardTitle>
            <CardDescription className="mt-0.5 line-clamp-1">
              {recipe.description}
            </CardDescription>
          </div>
          {recipe.tier === 'experimental' || recipe.status === 'draft' ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-900 dark:text-amber-200">
              <FlaskConical className="h-3 w-3" />
              {dictionary.experimental}
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              {dictionary.recommendedBadge}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <VerificationPill
            label={dictionary.generate}
            value={recipe.verification.generate}
          />
          <VerificationPill
            label={dictionary.install}
            value={recipe.verification.install}
          />
          <VerificationPill
            label={dictionary.build}
            value={recipe.verification.build}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {recipe.baseTemplate}
          </span>
          <Button
            size="sm"
            variant={selected ? 'secondary' : 'default'}
            onClick={onSelect}
          >
            {selected ? dictionary.selected : dictionary.openRecipe}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DependencyEditor({
  title,
  placeholder,
  value,
  items,
  addLabel,
  onValueChange,
  onAdd,
  onRemove,
}: {
  title: string
  placeholder: string
  value: string
  items: string[]
  addLabel: string
  onValueChange: (value: string) => void
  onAdd: () => void
  onRemove: (dependency: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onAdd()
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          {addLabel}
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item}
              type="button"
              className="max-w-full rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs"
              onClick={() => onRemove(item)}
              title={`Remove ${item}`}
            >
              <span className="inline-block max-w-44 truncate align-bottom">
                {item}
              </span>
              <span className="ml-1 text-muted-foreground">x</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function VerificationSummary({
  verification,
  dictionary,
}: {
  verification: RecipeCatalogItem['verification']
  dictionary: Dictionary['workbench']
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <VerificationPill
        label={dictionary.generate}
        value={verification.generate}
      />
      <VerificationPill
        label={dictionary.install}
        value={verification.install}
      />
      <VerificationPill label={dictionary.build} value={verification.build} />
    </div>
  )
}

function VerificationPill({ label, value }: { label: string; value: boolean }) {
  return (
    <span
      className={cn(
        'rounded-md border px-2 py-1 text-center text-xs font-medium',
        value
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-border bg-muted text-muted-foreground',
      )}
    >
      {label}
    </span>
  )
}

function SummaryList({
  title,
  items,
  mono,
}: {
  title: string
  items: string[]
  mono?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {items.length > 0 ? (
        <div className="space-y-1">
          {items.map((item) => (
            <p
              key={item}
              className={cn(
                'truncate rounded-md border border-border bg-muted/30 px-2 py-1 text-xs',
                mono && 'font-mono',
              )}
              title={item}
            >
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
          none
        </p>
      )}
    </div>
  )
}

function StatusBadge({
  status,
  label,
}: {
  status: string | SupportStatus
  label: string
}) {
  return (
    <span
      className={cn(
        'rounded-md border px-2 py-1 text-xs font-medium uppercase',
        (status === 'supported' || status === 'recommended') &&
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        (status === 'experimental' || status === 'draft') &&
          'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
        status !== 'supported' &&
          status !== 'recommended' &&
          status !== 'experimental' &&
          status !== 'draft' &&
          'border-border bg-muted text-muted-foreground',
      )}
    >
      {label}
    </span>
  )
}

function defaultOptions(recipe: RecipeManifest) {
  return Object.fromEntries(
    Object.entries(recipe.options).map(([key, option]) => [
      key,
      option.default,
    ]),
  )
}

function defaultProjectName(recipeId: string) {
  if (recipeId.includes('router')) return 'react-router-app'
  if (recipeId.includes('vite')) return 'react-vite-app'
  return 'my-react-app'
}

function parseDependencyInput(input: string) {
  return input
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function mergeDependencies(current: string[], nextItems: string[]) {
  return Array.from(new Set([...current, ...nextItems]))
}

function findPreviewFile(
  preview: RecipePreviewDetails,
  path: string,
): PreviewFile | undefined {
  return (
    preview.selectedFiles.find((file) => file.path === path) ??
    preview.files.find((file) => file.path === path)
  )
}
