"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, FolderTree, ShieldCheck } from "lucide-react"
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
    <Card className="preview-panel gap-0 overflow-hidden border-0 py-0 shadow-none">
      <CardHeader className="preview-panel__header px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-5 w-5 text-primary" />
              {dictionary.structure}
            </CardTitle>
            <CardDescription>{dictionary.description}</CardDescription>
          </div>
          {details && (
            <span
              className={cn(
                "status-badge",
                details.support_status === "supported" && "status-badge--supported",
                details.support_status === "experimental" && "status-badge--experimental",
                details.support_status === "unavailable" && "status-badge--unavailable",
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
      <CardContent className="px-5 py-5">
        {details && (
          <div className="verification-strip mb-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {dictionary.verifiedIn.replace("{version}", details.verification.matrix)}
            </p>
            <div className="verification-strip__items">
              <VerificationItem label={dictionary.generate} value={details.verification.generate} />
              <VerificationItem label={dictionary.install} value={details.verification.install} />
              <VerificationItem label={dictionary.build} value={details.verification.build} />
            </div>
          </div>
        )}

        <Tabs defaultValue="tree" className="w-full">
          <TabsList className="preview-tabs grid h-auto w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="tree" className="h-8 text-xs sm:text-sm">{dictionary.tabs.structure}</TabsTrigger>
            <TabsTrigger value="package" className="h-8 text-xs sm:text-sm">package.json</TabsTrigger>
            <TabsTrigger value="readme" className="h-8 text-xs sm:text-sm">README</TabsTrigger>
            <TabsTrigger value="commands" className="h-8 text-xs sm:text-sm">{dictionary.tabs.commands}</TabsTrigger>
          </TabsList>

          <TabsContent value="tree" className="mt-3">
            <ScrollArea className="blueprint-canvas h-[520px] w-full rounded-md p-4">
              <div className="blueprint-canvas__label">
                <FolderTree className="h-4 w-4" />
                <span>{dictionary.structure}</span>
              </div>
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
            <ScrollArea className="blueprint-canvas h-[520px] w-full rounded-md p-4">
              {details ? (
                <div className="space-y-2">
                  {details.commands.map((command) => (
                    <code key={command} className="command-line block rounded-md px-3 py-2 font-mono text-sm">
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
    <span className="verification-chip">
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
    <ScrollArea className="blueprint-canvas h-[520px] w-full rounded-md">
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
    <div className="rounded-md bg-muted/35 p-3">
      <p className="font-mono font-medium text-foreground">{title}</p>
      <p className="mt-1 font-mono">{items.length > 0 ? items.join(", ") : "none"}</p>
    </div>
  )
}
