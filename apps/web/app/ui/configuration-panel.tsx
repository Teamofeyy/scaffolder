"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Check, Settings2, Package, Palette, Search } from "lucide-react"
import { ConfigurationPanelProps, ConfigKey, ConfigValue, Linting, Framework, Routing, PackageManager, Styling, StateManagement } from "@/types/project-config"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { DependencySearchResult, searchDependencies } from "@/lib/api"
import { useEffect, useState } from "react"

export interface Feature {
  name: string;
  label: string;
  description: string;
  category: string;
  requires: string[];
  conflicts: string[];
}

function defaultRoutingForFramework(framework: Framework): Routing {
  if (framework === "nextjs") return "app-router";
  if (framework === "react" || framework === "react-ts") return "react-router";
  if (framework === "vue" || framework === "vue-ts" || framework === "nuxt-ts") return "vue-router";
  return "none";
}

function routingOptionsForFramework(framework: Framework): { value: Routing; label: string }[] {
  if (framework === "nextjs") {
    return [
      { value: "app-router", label: "App Router" },
      { value: "pages-router", label: "Pages Router" },
    ];
  }

  if (framework === "react" || framework === "react-ts") {
    return [
      { value: "react-router", label: "React Router" },
      { value: "react-router-data", label: "React Router Data" },
      { value: "none", label: "Без роутинга" },
    ];
  }

  if (framework === "vue" || framework === "vue-ts" || framework === "nuxt-ts") {
    return [
      { value: "vue-router", label: "Vue Router" },
      { value: "none", label: "Без роутинга" },
    ];
  }

  return [{ value: "none", label: "Без роутинга" }];
}

function supportsReactState(framework: Framework) {
  return framework === "react" || framework === "react-ts" || framework === "nextjs";
}

const frameworkOptions: { value: Framework; label: string; hint: string }[] = [
  { value: "react", label: "React", hint: "SPA на Vite" },
  { value: "nextjs", label: "Next.js", hint: "React fullstack" },
  { value: "vue", label: "Vue", hint: "SPA на Vite" },
  { value: "svelte-ts", label: "Svelte", hint: "Легкий TS шаблон" },
  { value: "solid-ts", label: "Solid", hint: "Fine-grained UI" },
  { value: "preact-ts", label: "Preact", hint: "Минимальный React-like" },
  { value: "nuxt-ts", label: "Nuxt", hint: "Vue fullstack" },
  { value: "angular-ts", label: "Angular", hint: "Enterprise SPA" },
]

const packageManagers: { value: PackageManager; label: string }[] = [
  { value: "npm", label: "npm" },
  { value: "pnpm", label: "pnpm" },
  { value: "yarn", label: "Yarn" },
  { value: "bun", label: "Bun" },
]

const stylingOptions: { value: Styling; label: string; hint: string }[] = [
  { value: "tailwind", label: "Tailwind", hint: "Utility-first CSS" },
  { value: "css-modules", label: "CSS Modules", hint: "Локальные CSS-классы" },
  { value: "styled-components", label: "Styled Components", hint: "CSS-in-JS" },
]

const reactStateOptions: { value: StateManagement; label: string; hint: string }[] = [
  { value: "none", label: "Не использовать", hint: "Оставить шаблон без state layer" },
  { value: "zustand", label: "Zustand", hint: "Минимальный store" },
  { value: "redux", label: "Redux Toolkit", hint: "Структурированный state" },
  { value: "jotai", label: "Jotai", hint: "Atom-based state" },
]

const nonReactStateOptions: { value: StateManagement; label: string; hint: string }[] = [
  { value: "none", label: "Не использовать", hint: "Для этого шаблона state layer не добавляется" },
]

const lintingOptions: { value: Linting; label: string; hint: string }[] = [
  { value: "eslint", label: "ESLint", hint: "Стандартная проверка Next.js" },
  { value: "biome", label: "Biome", hint: "Быстрый formatter/linter" },
  { value: "none", label: "Без линтера", hint: "Не добавлять настройку" },
]

type DependencyListItem = {
  id: string
  name: string
  label: string
  version?: string
  description?: string
}

function dependencyName(raw: string) {
  const idx = raw.lastIndexOf("@")
  if (idx > 0) return raw.slice(0, idx)
  return raw
}

function dependencyToken(dep: DependencyListItem) {
  return dep.version ? `${dep.name}@^${dep.version}` : dep.id
}

export function ConfigurationPanel({ config, setConfig }: ConfigurationPanelProps) {
  const [dependencyQuery, setDependencyQuery] = useState("");
  const [npmResults, setNpmResults] = useState<DependencySearchResult[]>([]);
  const [isSearchingDependencies, setIsSearchingDependencies] = useState(false);
  const [dependencySearchError, setDependencySearchError] = useState<string | null>(null);
  const updateConfig = (key: ConfigKey, value: ConfigValue) => {
    if (key === "framework") {
      const framework = value as Framework;
      const options = routingOptionsForFramework(framework);
      const currentRoutingStillValid = options.some((option) => option.value === config.routing);
      setConfig({
        ...config,
        framework,
        routing: currentRoutingStillValid ? config.routing : defaultRoutingForFramework(framework),
        stateManagement: supportsReactState(framework) ? config.stateManagement : "none",
      });
      return;
    }

    setConfig({ ...config, [key]: value })
  }

  const updateLinting = (value: Linting) => {
    setConfig({ ...config, linting: value })
  }

  const routingOptions = routingOptionsForFramework(config.framework);
  const stateOptions = supportsReactState(config.framework) ? reactStateOptions : nonReactStateOptions;
  const remoteDependencies = npmResults.map((dep) => ({
    id: `${dep.name}@${dep.version}`,
    name: dep.name,
    label: dep.name,
    version: dep.version,
    description: dep.description,
  }));
  const dependencyItems: DependencyListItem[] = remoteDependencies;
  const removeDependency = (bucket: "prod" | "dev", dependency: string) => {
    setConfig({
      ...config,
      dependencies: bucket === "prod"
        ? config.dependencies.filter((item) => item !== dependency)
        : config.dependencies,
      devDependencies: bucket === "dev"
        ? config.devDependencies.filter((item) => item !== dependency)
        : config.devDependencies,
    })
  }

  useEffect(() => {
    const query = dependencyQuery.trim();
    if (query.length < 2) {
      setNpmResults([]);
      setDependencySearchError(null);
      setIsSearchingDependencies(false);
      return;
    }

    let cancelled = false;
    setIsSearchingDependencies(true);
    setDependencySearchError(null);

    const timeoutId = window.setTimeout(() => {
      searchDependencies(query)
        .then((results) => {
          if (!cancelled) setNpmResults(results);
        })
        .catch(() => {
          if (!cancelled) {
            setNpmResults([]);
            setDependencySearchError("Не удалось получить результаты из npm");
          }
        })
        .finally(() => {
          if (!cancelled) setIsSearchingDependencies(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [dependencyQuery]);

  return (
    <Card className="gap-4 border-border/50 py-4 shadow-lg">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          Конфигурация проекта
        </CardTitle>
        <CardDescription>Настройте параметры вашего нового проекта</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Основное</TabsTrigger>
            <TabsTrigger value="styling">Стили</TabsTrigger>
            <TabsTrigger value="tools">Инструменты</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Название проекта</Label>
              <Input
                id="projectName"
                placeholder="my-awesome-app"
                value={config.projectName}
                onChange={(e) => updateConfig("projectName", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Фреймворк</Label>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 2xl:grid-cols-4" role="radiogroup" aria-label="Фреймворк">
                {frameworkOptions.map((option) => {
                  const selected = config.framework === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={cn(
                        "min-h-14 rounded-md border p-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background hover:bg-accent hover:text-accent-foreground",
                      )}
                      onClick={() => updateConfig("framework", option.value)}
                    >
                      <span className="block text-sm font-semibold leading-5">{option.label}</span>
                      <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{option.hint}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Менеджер пакетов</Label>
              <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Менеджер пакетов">
                {packageManagers.map((manager) => {
                  const selected = config.packageManager === manager.value
                  return (
                    <button
                      key={manager.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={cn(
                        "h-10 rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-accent hover:text-accent-foreground",
                      )}
                      onClick={() => updateConfig("packageManager", manager.value)}
                    >
                      {manager.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Роутинг</Label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Роутинг">
                {routingOptions.map((option) => {
                  const selected = config.routing === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={cn(
                        "h-10 rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-accent hover:text-accent-foreground",
                      )}
                      onClick={() => updateConfig("routing", option.value)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

          </TabsContent>

          <TabsContent value="styling" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="styling" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Система стилизации
              </Label>
              <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Система стилизации">
                {stylingOptions.map((option) => {
                  const selected = config.styling === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={cn(
                        "min-h-12 rounded-md border p-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background hover:bg-accent hover:text-accent-foreground",
                      )}
                      onClick={() => updateConfig("styling", option.value)}
                    >
                      <span className="block text-sm font-semibold leading-5">{option.label}</span>
                      <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{option.hint}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stateManagement" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                State Management
              </Label>
              <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="State Management">
                {stateOptions.map((option) => {
                  const selected = config.stateManagement === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={cn(
                        "min-h-12 rounded-md border p-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background hover:bg-accent hover:text-accent-foreground",
                      )}
                      onClick={() => updateConfig("stateManagement", option.value)}
                    >
                      <span className="block text-sm font-semibold leading-5">{option.label}</span>
                      <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{option.hint}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4 mt-4">
            {/* Linting options */}
            <div className="space-y-2">
              <Label htmlFor="linting" className="flex items-center gap-2">
                Линтер
              </Label>
              {config.framework === "nextjs" ? (
                <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Линтер">
                  {lintingOptions.map((option) => {
                    const selected = config.linting === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={cn(
                          "min-h-12 rounded-md border p-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-background hover:bg-accent hover:text-accent-foreground",
                        )}
                        onClick={() => updateLinting(option.value)}
                      >
                        <span className="block text-sm font-semibold leading-5">{option.label}</span>
                        <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{option.hint}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Линтер настраивается только для Next.js проектов. Для других фреймворков будут использованы настройки шаблона.
                </p>
              )}
            </div>

            {/* Dependency search / selection */}
            <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Дополнительные зависимости
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Найдите пакет в npm и добавьте его как runtime или dev dependency.
                  </p>
                </div>
              </div>

              <Input
                placeholder="Поиск зависимости (axios, zod, bcrypt...)"
                className="mt-1"
                value={dependencyQuery}
                onChange={(e) => setDependencyQuery(e.target.value)}
              />

              {(config.dependencies.length > 0 || config.devDependencies.length > 0) && (
                <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-3">
                  <p className="text-sm font-medium">Выбранные зависимости</p>
                  <div className="space-y-2">
                    {config.dependencies.map((dependency) => (
                      <SelectedDependency
                        key={`prod-${dependency}`}
                        dependency={dependency}
                        label="dep"
                        onRemove={() => removeDependency("prod", dependency)}
                      />
                    ))}
                    {config.devDependencies.map((dependency) => (
                      <SelectedDependency
                        key={`dev-${dependency}`}
                        dependency={dependency}
                        label="dev"
                        onRemove={() => removeDependency("dev", dependency)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <ScrollArea className="h-48 w-full rounded-md border border-border/50 bg-muted/20">
                <div className="p-2 space-y-1">
                  {dependencyItems.map((dep) => {
                    const selectedProd = config.dependencies.some((item) => dependencyName(item) === dep.name)
                    const selectedDev = config.devDependencies.some((item) => dependencyName(item) === dep.name)
                    const selectDependency = (bucket: "prod" | "dev") => {
                      const token = dependencyToken(dep)
                      const nextDependencies = config.dependencies.filter((item) => dependencyName(item) !== dep.name)
                      const nextDevDependencies = config.devDependencies.filter((item) => dependencyName(item) !== dep.name)

                      if (bucket === "prod" && !selectedProd) {
                        nextDependencies.push(token)
                      }
                      if (bucket === "dev" && !selectedDev) {
                        nextDevDependencies.push(token)
                      }

                      setConfig({
                        ...config,
                        dependencies: nextDependencies,
                        devDependencies: nextDevDependencies,
                      })
                    }

                    return (
                      <div
                        key={dep.id}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors",
                          selectedProd || selectedDev ? "border-primary/40 bg-primary/10" : "border-transparent hover:bg-accent/40",
                        )}
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-mono">
                            {dep.label}
                            {dep.version && (
                              <span className="ml-2 font-sans text-xs text-muted-foreground">
                                {dep.version}
                              </span>
                            )}
                          </p>
                          {dep.description && (
                            <p className="text-xs text-muted-foreground">{dep.description}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Добавить ${dep.name}`}>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              selectedProd
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:bg-accent",
                            )}
                            onClick={() => selectDependency("prod")}
                          >
                            {selectedProd && <Check className="h-3 w-3" />}
                            dep
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              selectedDev
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:bg-accent",
                            )}
                            onClick={() => selectDependency("dev")}
                          >
                            {selectedDev && <Check className="h-3 w-3" />}
                            dev
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {isSearchingDependencies && (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                      Поиск в npm...
                    </p>
                  )}
                  {!isSearchingDependencies && dependencySearchError && (
                    <p className="px-3 py-4 text-center text-sm text-destructive">
                      {dependencySearchError}
                    </p>
                  )}
                  {!isSearchingDependencies && !dependencySearchError && dependencyItems.length === 0 && (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {dependencyQuery.trim().length < 2
                        ? "Введите название пакета"
                        : "Ничего не найдено"}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function SelectedDependency({
  dependency,
  label,
  onRemove,
}: {
  dependency: string
  label: "dep" | "dev"
  onRemove: () => void
}) {
  const name = dependencyName(dependency)
  const version = dependencyVersion(dependency, name)

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm">
          {name}
          {version && (
            <span className="ml-2 font-sans text-xs text-muted-foreground">{version}</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {label}
        </span>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onRemove}
          aria-label={`Удалить ${name}`}
        >
          x
        </button>
      </div>
    </div>
  )
}

function dependencyVersion(raw: string, name: string) {
  const prefix = `${name}@`
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : undefined
}
