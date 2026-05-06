"use client"

import { Button } from "@/components/ui/button"
import { Download, Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { GenerateButtonProps } from "@/types/project-config"
import { buildProject, downloadFile, validateConfig } from "@/lib/api"

export function GenerateButton({ config }: GenerateButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    // Валидация
    const validation = validateConfig(config)
    if (!validation.valid) {
      toast.error("Ошибка валидации", {
        description: validation.error || "Проверьте заполнение формы",
      })
      return
    }

    setIsGenerating(true)

    try {
      toast.info("Начало сборки проекта...", {
        description: "Это может занять некоторое время",
      })

      // Отправка запроса на сборку
      const zipBlob = await buildProject(config)

      // Скачивание файла
      const filename = `${config.projectName}.zip`
      downloadFile(zipBlob, filename)

      toast.success("Проект создан!", {
        description: `Архив ${filename} скачан успешно`,
      })
    } catch (error) {
      console.error("Ошибка при сборке проекта:", error)
      toast.error("Ошибка при сборке проекта", {
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
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
            Генерация проекта...
          </>
        ) : (
          <>
            <Download className="h-5 w-5" />
            Сгенерировать проект
          </>
        )}
      </Button>
    </div>
  )
}
