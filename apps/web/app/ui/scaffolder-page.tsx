"use client"

import { useEffect, useState } from "react"
import { Boxes, FileArchive, GitBranch, Layers3, PackageCheck, Palette } from "lucide-react"
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

  const projectName = config.projectName.trim() || "my-awesome-app"
  const dependencyCount = config.dependencies.length + config.devDependencies.length
  const recipeItems = [
    { label: dictionary.terminal.framework, value: config.framework, icon: Boxes },
    { label: dictionary.terminal.style, value: config.styling, icon: Palette },
    { label: dictionary.terminal.dependencies, value: dependencyCount === 0 ? "template defaults" : `${dependencyCount} selected`, icon: PackageCheck },
  ]

  return (
    <div className="app-shell min-h-screen">
      <Header locale={locale} dictionary={dictionary.header} />

      <main className="foundry-shell relative z-10 mx-auto max-w-[1720px] px-3 pb-28 pt-4 sm:px-5 lg:px-6">
        <section className="foundry-hero" aria-labelledby="scaffolder-title">
          <div className="foundry-hero__copy">
            <div className="foundry-kicker">
              <Layers3 className="h-4 w-4" />
              <span>{dictionary.hero.eyebrow}</span>
            </div>
            <h1 id="scaffolder-title" className="foundry-title">
              {dictionary.hero.title}
            </h1>
            <p className="foundry-lede">
              {dictionary.hero.description}
            </p>
          </div>

          <aside className="recipe-card" aria-label={dictionary.preview.structure}>
            <div className="recipe-card__top">
              <div>
                <p className="recipe-card__label">{dictionary.preview.structure}</p>
                <p className="recipe-card__name">{projectName}</p>
              </div>
              <FileArchive className="h-5 w-5 text-primary" />
            </div>
            <dl className="recipe-card__list">
              {recipeItems.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="recipe-card__row">
                    <dt>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </dt>
                    <dd>{item.value}</dd>
                  </div>
                )
              })}
            </dl>
            <div className="recipe-card__footer">
              <GitBranch className="h-4 w-4" />
              <span>{dictionary.terminal.ready}</span>
            </div>
          </aside>
        </section>

        <div className="foundry-workspace">
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
