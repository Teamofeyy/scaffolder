"use client"

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import { Bot, Check, Loader2, MessageSquare, Sparkles, Wand2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AiConfigPatch, AiRecommendationResponse, recommendProjectConfig } from "@/lib/api"
import { cn } from "@/lib/utils"
import { ProjectConfig } from "@/types/project-config"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"

interface AiSidebarProps {
  config: ProjectConfig
  setConfig: (config: ProjectConfig) => void
  locale: Locale
  dictionary: Dictionary["ai"]
}

const SESSION_STORAGE_KEY = "scaffolder_ai_session_id"
const MAX_MESSAGE_LENGTH = 1500

export function AiSidebar({ config, setConfig, locale, dictionary }: AiSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [recommendation, setRecommendation] = useState<AiRecommendationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appliedRequestId, setAppliedRequestId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const patchRows = useMemo(() => {
    if (!recommendation) return []
    return configPatchRows(recommendation.configPatch, dictionary.labels)
  }, [recommendation, dictionary.labels])

  const handleSubmit = async () => {
    const trimmed = message.trim()
    if (!trimmed) {
      setError(dictionary.emptyMessage)
      return
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setError(dictionary.messageTooLong)
      return
    }

    setIsLoading(true)
    setError(null)
    setAppliedRequestId(null)

    try {
      const result = await recommendProjectConfig(trimmed, sessionId(), config, locale)
      setRecommendation(result)
    } catch (err) {
      const description = err instanceof Error ? err.message : dictionary.recommendationError
      setError(description)
      toast.error(dictionary.unavailable, { description })
    } finally {
      setIsLoading(false)
    }
  }

  const applyRecommendation = () => {
    if (!recommendation) return

    setConfig(applyConfigPatch(config, recommendation.configPatch))
    setAppliedRequestId(recommendation.requestId)
    toast.success(dictionary.appliedTitle, {
      description: dictionary.appliedDescription,
    })
  }

  const closeDialog = () => {
    setIsOpen(false)
    window.setTimeout(() => openerRef.current?.focus(), 0)
  }

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      closeDialog()
      return
    }

    if (event.key !== "Tab") return

    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const focusable = Array.from(focusableElements ?? []).filter(
      (element) => !element.hasAttribute("disabled") && element.offsetParent !== null,
    )

    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
      return
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <Button
        type="button"
        ref={openerRef}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="fixed bottom-5 right-5 z-[70] h-12 rounded-md px-4 shadow-2xl"
        onClick={() => setIsOpen(true)}
      >
        <MessageSquare className="h-5 w-5" />
        AI
      </Button>

      {isOpen && (
          <aside
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-sidebar-title"
            className="fixed bottom-0 right-0 top-0 z-[80] flex w-full max-w-[440px] flex-col border-l border-border bg-background shadow-2xl"
            onKeyDown={handleDialogKeyDown}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md border border-primary/30 bg-primary/10 p-2">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 id="ai-sidebar-title" className="text-sm font-semibold leading-5">{dictionary.title}</h2>
                  <p className="text-xs text-muted-foreground">{dictionary.subtitle}</p>
                </div>
              </div>
              <Button
                ref={closeButtonRef}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={dictionary.close}
                onClick={closeDialog}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-4">
                {!recommendation && !isLoading && (
                  <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-8 text-center">
                    <Wand2 className="mx-auto mb-3 h-6 w-6 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {dictionary.emptyState}
                    </p>
                  </div>
                )}

                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                {recommendation && (
                  <>
                    <div className="space-y-2 rounded-md border border-border/60 bg-card px-3 py-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Wand2 className="h-4 w-4 text-primary" />
                        {dictionary.recommendation}
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{recommendation.message}</p>
                    </div>

                    {recommendation.warnings.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">{dictionary.important}</p>
                        <div className="space-y-2">
                          {recommendation.warnings.map((warning) => (
                            <p
                              key={warning}
                              className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground"
                            >
                              {warning}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {patchRows.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">{dictionary.willApply}</p>
                        <div className="space-y-1 rounded-md border border-border/60 bg-card p-2">
                          {patchRows.map((row) => (
                            <div key={row.label} className="flex items-start justify-between gap-3 rounded-md px-2 py-1.5 text-sm">
                              <span className="text-muted-foreground">{row.label}</span>
                              <span className="max-w-[58%] text-right font-medium">{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {appliedRequestId === recommendation.requestId && (
                      <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                        {dictionary.appliedNotice}
                      </p>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="shrink-0 space-y-3 border-t border-border bg-background p-4">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={dictionary.placeholder}
                maxLength={MAX_MESSAGE_LENGTH}
                className="min-h-28 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{message.length}/{MAX_MESSAGE_LENGTH}</span>
                <div className="flex items-center gap-2">
                  {recommendation && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyRecommendation}
                      disabled={appliedRequestId === recommendation.requestId}
                    >
                      <Check className={cn("h-4 w-4", appliedRequestId === recommendation.requestId && "text-primary")} />
                      {appliedRequestId === recommendation.requestId
                        ? dictionary.applied
                        : dictionary.apply}
                    </Button>
                  )}
                  <Button type="button" size="sm" onClick={handleSubmit} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {dictionary.send}
                  </Button>
                </div>
              </div>
            </div>
          </aside>
      )}
    </>
  )
}

function sessionId() {
  const stored = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (stored) return stored

  const next = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
  window.localStorage.setItem(SESSION_STORAGE_KEY, next)
  return next
}

function applyConfigPatch(config: ProjectConfig, patch: AiConfigPatch): ProjectConfig {
  return {
    ...config,
    framework: patch.framework ?? config.framework,
    routing: patch.routing ?? config.routing,
    styling: patch.styling ?? config.styling,
    linting: patch.linting ?? config.linting,
    stateManagement: patch.state_management ?? config.stateManagement,
    dependencies: patch.dependencies ?? config.dependencies,
    devDependencies: patch.dev_dependencies ?? config.devDependencies,
  }
}

function configPatchRows(
  patch: AiConfigPatch,
  labels: Dictionary["ai"]["labels"],
) {
  const rows: { label: string; value: string }[] = []

  if (patch.framework) rows.push({ label: labels.framework, value: patch.framework })
  if (patch.routing) rows.push({ label: labels.routing, value: patch.routing })
  if (patch.styling) rows.push({ label: labels.styling, value: patch.styling })
  if (patch.linting) rows.push({ label: labels.linter, value: patch.linting })
  if (patch.state_management) rows.push({ label: labels.state, value: patch.state_management })
  if (patch.dependencies?.length) rows.push({ label: labels.dependencies, value: patch.dependencies.join(", ") })
  if (patch.dev_dependencies?.length) rows.push({ label: labels.devDependencies, value: patch.dev_dependencies.join(", ") })

  return rows
}
