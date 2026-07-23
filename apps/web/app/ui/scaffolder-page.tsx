"use client"

import { Header } from "./header"
import { RecipeWorkbench } from "./recipe-workbench"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"

interface ScaffolderPageProps {
  locale: Locale
  dictionary: Dictionary
}

export function ScaffolderPage({ locale, dictionary }: ScaffolderPageProps) {
  return (
    <div className="app-shell min-h-screen">
      <Header locale={locale} dictionary={dictionary.header} />
      <RecipeWorkbench dictionary={dictionary.workbench} errors={dictionary.errors} />
    </div>
  )
}
