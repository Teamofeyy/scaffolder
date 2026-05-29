"use client"

import { useState } from "react"
import { Boxes, Terminal } from "lucide-react"
import { Header } from "./ui/header"
import { ConfigurationPanel } from "./ui/configuration-panel"
import { PreviewPanel } from "./ui/preview-panel"
import { GenerateButton } from "./ui/generate-button"
import { ProjectConfig } from "@/types/project-config"

export default function ScaffolderPage() {
  const [config, setConfig] = useState<ProjectConfig>({
    projectName: "",
    framework: "react",
    packageManager: "npm",
    typescript: true,
    styling: "tailwind",
    linting: "eslint",
    stateManagement: "none",
    routing: "react-router",
    dependencies: [],
    devDependencies: [],
  })

  return (
    <div className="app-shell min-h-screen">
      <Header />

      <main className="relative z-10 mx-auto max-w-[1600px] px-5 py-5">
        <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Boxes className="h-4 w-4" />
              template runtime
            </div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-5xl">
            Scaffolder
          </h1>
            <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
            Создайте идеальную структуру для вашего следующего проекта за считанные секунды
          </p>
          </div>

          <div className="terminal-hero" aria-hidden="true">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs text-muted-foreground">
              <Terminal className="h-4 w-4 text-primary" />
              scaffold.config
            </div>
            <div className="space-y-2 p-4 font-mono text-sm">
              <p><span className="text-primary">framework</span> = react</p>
              <p><span className="text-primary">style</span> = tailwind</p>
              <p><span className="text-primary">deps</span> = npm registry</p>
              <p className="text-primary">archive ready in &lt; 5s</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(520px,0.95fr)] mb-5">
          <ConfigurationPanel config={config} setConfig={setConfig} />
          <PreviewPanel config={config} />
        </div>

        <GenerateButton config={config} />
      </main>
    </div>
  )
}
