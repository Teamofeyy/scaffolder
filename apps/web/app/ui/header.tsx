"use client"

import Image from "next/image"
import { usePathname } from "next/navigation"
import { Github, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import { isLocale, locales, type Locale } from "@/lib/i18n/config"

interface HeaderProps {
  locale: Locale
  dictionary: Dictionary["header"]
}

export function Header({ locale, dictionary }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
  }, [])

  const localizedPath = (nextLocale: Locale) => {
    const segments = pathname.split("/").filter(Boolean)

    if (segments.length === 0) return `/${nextLocale}`

    if (isLocale(segments[0])) {
      segments[0] = nextLocale
    } else {
      segments.unshift(nextLocale)
    }

    return `/${segments.join("/")}`
  }

  return (
    <header className="foundry-header sticky top-0 z-50">
      <div className="foundry-nav mx-auto flex max-w-[1720px] items-center justify-between px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Image src="/brand-mark.svg" alt="" width={40} height={40} priority className="size-9 sm:size-10" />
          <div className="hidden min-[360px]:block">
            <span className="block text-xl font-bold leading-5">Scaffolder</span>
            <span className="block font-mono text-xs text-muted-foreground">
              {dictionary.subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <div
            className="flex h-9 items-center rounded-md border border-border bg-muted/40 p-0.5"
            aria-label={dictionary.language}
          >
            {locales.map((item) => (
              <Button
                key={item}
                variant={item === locale ? "secondary" : "ghost"}
                size="sm"
                className="h-7 min-w-9 px-2 font-mono text-xs uppercase"
                asChild
              >
                <a href={localizedPath(item)} hrefLang={item}>
                  {item}
                </a>
              </Button>
            ))}
          </div>

          <Button variant="ghost" size="icon" asChild>
            <a href="https://github.com/Teamofeyy/scaffolder" target="_blank" rel="noopener noreferrer">
              <Github className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </a>
          </Button>

          {mounted && (
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span className="sr-only">{dictionary.theme}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
