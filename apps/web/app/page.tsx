"use client"

import { useState } from "react"
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
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-12 text-center space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-balance bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Scaffolder
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Создайте идеальную структуру для вашего следующего проекта за считанные секунды
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <ConfigurationPanel config={config} setConfig={setConfig} />
          <PreviewPanel config={config} />
        </div>

        <GenerateButton config={config} />
      </main>
    </div>
  )
}
