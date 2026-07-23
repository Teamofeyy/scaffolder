import 'server-only'

import type { Locale } from './config'

const dictionaries = {
  ru: () => import('./dictionaries/ru.json').then((module) => module.default),
  en: () => import('./dictionaries/en.json').then((module) => module.default),
}

export type Dictionary = typeof import('./dictionaries/ru.json')

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]()
}
