"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye } from "lucide-react"
import { FileTree } from "./file-tree"
import { PreviewPanelProps } from "@/types/project-config"
import { previewProject, ProjectTreeNode } from "@/lib/api"
import { useEffect, useState } from "react"




export function PreviewPanel({ config, dictionary }: PreviewPanelProps) {
  const [tree, setTree] = useState<ProjectTreeNode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => {
      previewProject(config)
        .then((nextTree) => {
          if (!cancelled) setTree(nextTree)
        })
        .catch(() => {
          if (!cancelled) setError(dictionary.error)
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [config, dictionary.error])

  return (
    <Card className="gap-4 border-border/50 py-4 shadow-lg">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          {dictionary.structure}
        </CardTitle>
        <CardDescription>{dictionary.description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <ScrollArea className="h-[420px] w-full rounded-md border border-border/50 bg-muted/20 p-3">
          {tree ? (
            <FileTree data={tree} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {isLoading ? dictionary.loading : error || dictionary.unavailable}
            </p>
          )}
          {tree && (isLoading || error) && (
            <p className="mt-3 text-xs text-muted-foreground">
              {isLoading ? dictionary.updating : error}
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
