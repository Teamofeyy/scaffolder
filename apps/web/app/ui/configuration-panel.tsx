"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings2, Package, Palette, Search } from "lucide-react"
import { ConfigurationPanelProps, ConfigKey, ConfigValue, popularDependencies, Linting } from "@/types/project-config"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export function ConfigurationPanel({ config, setConfig }: ConfigurationPanelProps) {
  const updateConfig = (key: ConfigKey, value: ConfigValue) => {
    setConfig({ ...config, [key]: value })
  }

  const updateLinting = (value: Linting) => {
    setConfig({ ...config, linting: value })
  }

  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          Конфигурация проекта
        </CardTitle>
        <CardDescription>Настройте параметры вашего нового проекта</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Основное</TabsTrigger>
            <TabsTrigger value="styling">Стили</TabsTrigger>
            <TabsTrigger value="tools">Инструменты</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6 mt-6">
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
              <Label htmlFor="framework">Фреймворк</Label>
              <Select value={config.framework} onValueChange={(value) => updateConfig("framework", value)}>
                <SelectTrigger id="framework">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="react">React</SelectItem>
                  <SelectItem value="nextjs">NextJs</SelectItem>
                  <SelectItem value="vite">Vue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="packageManager">Менеджер пакетов</Label>
              <Select value={config.packageManager} onValueChange={(value) => updateConfig("packageManager", value)}>
                <SelectTrigger id="packageManager">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="npm">npm</SelectItem>
                  <SelectItem value="pnpm">pnpm</SelectItem>
                  <SelectItem value="yarn">yarn</SelectItem>
                  <SelectItem value="bun">bun</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="routing">Роутинг</Label>
              <Select value={config.routing} onValueChange={(value) => updateConfig("routing", value)}>
                <SelectTrigger id="routing">
                  <SelectValue />
                </SelectTrigger>

                {config.framework === "nextjs" && (
                  <SelectContent>
                    <SelectItem value="app-router">App Router</SelectItem>
                    <SelectItem value="pages-router">Pages Router</SelectItem>
                  </SelectContent>
                )}

                {config.framework === "react" && (
                  <SelectContent>
                    <SelectItem value="react-router">React Router</SelectItem>
                    <SelectItem value="react-router-data">React Router(Data)</SelectItem>
                    <SelectItem value="none">None</SelectItem>

                  </SelectContent>
                )}

                {config.framework === "vue" && (
                  <SelectContent>
                    <SelectItem value="vue-router">VueRouter</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                )}


              </Select>
            </div>

          </TabsContent>

          <TabsContent value="styling" className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="styling" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Система стилизации
              </Label>
              <Select value={config.styling} onValueChange={(value) => updateConfig("styling", value)}>
                <SelectTrigger id="styling">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tailwind">Tailwind</SelectItem>
                  <SelectItem value="css-modules">Sass</SelectItem>
                  <SelectItem value="styled-components">PostCSS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stateManagement" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                State Management
              </Label>
              <Select value={config.stateManagement} onValueChange={(value) => updateConfig("stateManagement", value)}>
                <SelectTrigger id="stateManagement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не использовать</SelectItem>
                  <SelectItem value="zustand">Zustand</SelectItem>
                  <SelectItem value="redux">Redux Toolkit</SelectItem>
                  <SelectItem value="jotai">Jotai</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="tools" className="space-y-6 mt-6">
            {/* Linting options */}
            <div className="space-y-2">
              <Label htmlFor="linting" className="flex items-center gap-2">
                Линтер
              </Label>
              {config.framework === "nextjs" ? (
                <Select
                  value={config.linting}
                  onValueChange={(value) => updateLinting(value as Linting)}
                >
                  <SelectTrigger id="linting">
                    <SelectValue placeholder="Выберите линтер" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eslint">ESLint (Next.js)</SelectItem>
                    <SelectItem value="biome">Biome</SelectItem>
                    <SelectItem value="none">Без линтера</SelectItem>
                  </SelectContent>
                </Select>
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
                    Найдите и добавьте популярные библиотеки. При пустом поиске показываются все.
                  </p>
                </div>
              </div>

              <Input
                placeholder="Поиск зависимости (axios, zod, bcrypt...)"
                className="mt-1"
                onChange={(e) => {
                  // локальный поиск реализуем через data-атрибуты в списке, чтобы не хранить стейт на уровне компонента конфигурации
                  const query = e.target.value.toLowerCase()
                  const container = document.querySelector<HTMLDivElement>("#dependencies-list")
                  if (!container) return
                  const items = Array.from(container.querySelectorAll<HTMLDivElement>('[data-dependency-id]'))
                  items.forEach((item) => {
                    const text = (item.dataset.searchText || "").toLowerCase()
                    item.style.display = !query || text.includes(query) ? "" : "none"
                  })
                }}
              />

              <ScrollArea className="h-56 w-full rounded-md border border-border/50 bg-muted/20">
                <div id="dependencies-list" className="p-2 space-y-1">
                  {popularDependencies.map((dep) => {
                    const selected = config.dependencies.includes(dep.id)
                    return (
                      <div
                        key={dep.id}
                        data-dependency-id={dep.id}
                        data-search-text={`${dep.label} ${dep.description || ""}`}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors",
                          selected ? "bg-primary/10 border border-primary/40" : "hover:bg-accent/40",
                        )}
                        onClick={() => {
                          const exists = config.dependencies.includes(dep.id)
                          const next = exists
                            ? config.dependencies.filter((d) => d !== dep.id)
                            : [...config.dependencies, dep.id]
                          setConfig({ ...config, dependencies: next })
                        }}
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-mono">{dep.label}</p>
                          {dep.description && (
                            <p className="text-xs text-muted-foreground">{dep.description}</p>
                          )}
                        </div>
                        {selected && (
                          <span className="text-xs font-medium text-primary border border-primary/40 rounded-full px-2 py-0.5">
                            выбрано
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
