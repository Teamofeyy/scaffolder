"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye } from "lucide-react"
import { FileTree } from "./file-tree"
import { PreviewPanelProps, generateProjectStructure } from "@/types/project-config"

export function PreviewPanel({ config }: PreviewPanelProps) {
  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          Предпросмотр структуры
        </CardTitle>
        <CardDescription>Файлы и папки вашего проекта</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-125 w-full rounded-md border border-border/50 bg-muted/20 p-4">
          <FileTree data={generateProjectStructure(config)} />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
