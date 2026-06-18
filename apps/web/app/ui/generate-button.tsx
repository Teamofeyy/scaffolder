"use client"

import { Button } from "@/components/ui/button"
import { Download, Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { GenerateButtonProps } from "@/types/project-config"
import { buildProject, downloadFile, validateConfig } from "@/lib/api"

export function GenerateButton({ config, dictionary, errors }: GenerateButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    // Валидация
    const validation = validateConfig(config, errors)
    if (!validation.valid) {
      toast.error(dictionary.validationTitle, {
        description: validation.error || dictionary.validationFallback,
      })
      return
    }

    setIsGenerating(true)

    try {
      toast.info(dictionary.startedTitle, {
        description: dictionary.startedDescription,
      })

      // Отправка запроса на сборку
      const zipBlob = await buildProject(config, errors)

      // Скачивание файла
      const filename = `${config.projectName}.zip`
      downloadFile(zipBlob, filename)

      toast.success(dictionary.successTitle, {
        description: dictionary.successDescription.replace("{filename}", filename),
      })
    } catch (error) {
      console.error(dictionary.errorTitle, error)
      toast.error(dictionary.errorTitle, {
        description: error instanceof Error ? error.message : dictionary.unknownError,
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex justify-center">
      <Button
        size="lg"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="gap-2 text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all"
      >
        {isGenerating ? (
          <>
            <Sparkles className="h-5 w-5 animate-spin" />
            {dictionary.generating}
          </>
        ) : (
          <>
            <Download className="h-5 w-5" />
            {dictionary.button}
          </>
        )}
      </Button>
    </div>
  )
}
