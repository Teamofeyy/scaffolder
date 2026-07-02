"use client"

import { useEffect, useState } from "react"
import { Boxes, Terminal } from "lucide-react"
import { Header } from "./header"
import { ConfigurationPanel } from "./configuration-panel"
import { PreviewPanel } from "./preview-panel"
import { GenerateButton } from "./generate-button"
import { AiSidebar } from "./ai-sidebar"
import { getCapabilities } from "@/lib/api"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"
import type { ProjectConfig } from "@/types/project-config"

interface ScaffolderPageProps {
  locale: Locale
  dictionary: Dictionary
}

export function ScaffolderPage({ locale, dictionary }: ScaffolderPageProps) {
  const [aiAvailable, setAiAvailable] = useState(false)
  const [config, setConfig] = useState<ProjectConfig>({
    projectName: "",
    framework: "react",
    typescript: true,
    styling: "tailwind",
    linting: "eslint",
    stateManagement: "none",
    routing: "react-router",
    dependencies: [],
    devDependencies: [],
    testing: "none",
  })

  useEffect(() => {
    let cancelled = false

    getCapabilities()
      .then((capabilities) => {
        if (!cancelled) setAiAvailable(capabilities.aiRecommendations)
      })
      .catch(() => {
        if (!cancelled) setAiAvailable(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app-shell min-h-screen">
      <Header locale={locale} dictionary={dictionary.header} />

      <main className="relative z-10 mx-auto max-w-[1600px] px-5 py-5">
        <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="space-y-3">
            <div className="eyebrow">
              <Boxes className="h-4 w-4" />
              {dictionary.hero.eyebrow}
            </div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-5xl">
              {dictionary.hero.title}
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
              {dictionary.hero.description}
            </p>
          </div>

          <div className="terminal-hero" aria-hidden="true">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs text-muted-foreground">
              <Terminal className="h-4 w-4 text-primary" />
              scaffold.config
            </div>
            <div className="space-y-2 p-4 font-mono text-sm">
              <p><span className="text-primary">{dictionary.terminal.framework}</span> = react</p>
              <p><span className="text-primary">{dictionary.terminal.style}</span> = tailwind</p>
              <p><span className="text-primary">{dictionary.terminal.dependencies}</span> = npm registry</p>
              <p className="text-primary">{dictionary.terminal.ready}</p>
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(520px,0.95fr)]">
          <ConfigurationPanel
            config={config}
            setConfig={setConfig}
            dictionary={dictionary.configuration}
          />
          <PreviewPanel config={config} dictionary={dictionary.preview} />
        </div>

        <GenerateButton
          config={config}
          dictionary={dictionary.generate}
          errors={dictionary.errors}
        />
      </main>
      {aiAvailable && (
        <AiSidebar
          config={config}
          setConfig={setConfig}
          locale={locale}
          dictionary={dictionary.ai}
        />
      )}
    </div>
  )
}
