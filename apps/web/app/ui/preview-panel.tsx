"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye } from "lucide-react"
import { FileTree } from "./file-tree"
import { PreviewPanelProps } from "@/types/project-config"
import { previewProjectDetails, PreviewDetails, PreviewFile } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"




export function PreviewPanel({ config, dictionary }: PreviewPanelProps) {
  const [details, setDetails] = useState<PreviewDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => {
      previewProjectDetails(config)
        .then((nextDetails) => {
          if (!cancelled) setDetails(nextDetails)
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

  const packageJson = details?.files.find((file) => file.path === "package.json")
  const readme = details?.files.find((file) => file.path === "README.md")
  const entryFiles = details?.files.filter((file) => file.path !== "package.json" && file.path !== "README.md") ?? []

  return (
    <Card className="gap-4 border-border/50 py-4 shadow-lg">
      <CardHeader className="px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {dictionary.structure}
            </CardTitle>
            <CardDescription>{dictionary.description}</CardDescription>
          </div>
          {details && (
            <span
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-semibold uppercase",
                details.support_status === "supported" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                details.support_status === "experimental" && "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300",
                details.support_status === "unavailable" && "border-border bg-muted text-muted-foreground",
              )}
            >
              {details.support_status === "supported"
                ? dictionary.status.supported
                : details.support_status === "experimental"
                  ? dictionary.status.experimental
                  : dictionary.status.unavailable}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5">
        {details && (
          <div className="mb-3 rounded-md border border-border/50 bg-muted/20 p-3 text-sm">
            <p className="font-medium">{dictionary.verifiedIn.replace("{version}", details.verification.matrix)}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <VerificationItem label={dictionary.generate} value={details.verification.generate} />
              <VerificationItem label={dictionary.install} value={details.verification.install} />
              <VerificationItem label={dictionary.build} value={details.verification.build} />
            </div>
          </div>
        )}

        <Tabs defaultValue="tree" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tree">{dictionary.tabs.structure}</TabsTrigger>
            <TabsTrigger value="package">package.json</TabsTrigger>
            <TabsTrigger value="readme">README</TabsTrigger>
            <TabsTrigger value="commands">{dictionary.tabs.commands}</TabsTrigger>
          </TabsList>

          <TabsContent value="tree" className="mt-3">
            <ScrollArea className="h-[420px] w-full rounded-md border border-border/50 bg-muted/20 p-3">
              {details?.tree ? (
                <FileTree data={details.tree} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isLoading ? dictionary.loading : error || dictionary.unavailable}
                </p>
              )}
              {details && (isLoading || error) && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {isLoading ? dictionary.updating : error}
                </p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="package" className="mt-3">
            <PreviewCode file={packageJson} fallback={dictionary.unavailable} />
            {details && (
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <DependencyList title="dependencies" items={details.dependencies} />
                <DependencyList title="devDependencies" items={details.dev_dependencies} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="readme" className="mt-3 space-y-3">
            <PreviewCode file={readme} fallback={dictionary.unavailable} />
            {entryFiles.length > 0 && (
              <div className="space-y-2">
                {entryFiles.map((file) => (
                  <PreviewCode key={file.path} file={file} fallback={dictionary.unavailable} title={file.path} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="commands" className="mt-3">
            <ScrollArea className="h-[420px] w-full rounded-md border border-border/50 bg-muted/20 p-3">
              {details ? (
                <div className="space-y-2">
                  {details.commands.map((command) => (
                    <code key={command} className="block rounded-md border border-border/60 bg-background px-3 py-2 font-mono text-sm">
                      {command}
                    </code>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isLoading ? dictionary.loading : error || dictionary.unavailable}
                </p>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function VerificationItem({ label, value }: { label: string; value: boolean }) {
  return (
    <span className="rounded-md border border-border/60 bg-background px-2 py-1">
      {label} {value ? "OK" : "-"}
    </span>
  )
}

function PreviewCode({
  file,
  fallback,
  title,
}: {
  file?: PreviewFile
  fallback: string
  title?: string
}) {
  return (
    <ScrollArea className="h-[420px] w-full rounded-md border border-border/50 bg-muted/20">
      {file ? (
        <div>
          {title && (
            <div className="border-b border-border/50 px-3 py-2 font-mono text-xs text-muted-foreground">
              {title}
            </div>
          )}
          <pre className="p-3 text-xs leading-5">
            <code>{file.content}</code>
          </pre>
        </div>
      ) : (
        <p className="p-3 text-sm text-muted-foreground">{fallback}</p>
      )}
    </ScrollArea>
  )
}

function DependencyList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 p-3">
      <p className="font-mono font-medium text-foreground">{title}</p>
      <p className="mt-1 font-mono">{items.length > 0 ? items.join(", ") : "none"}</p>
    </div>
  )
}
