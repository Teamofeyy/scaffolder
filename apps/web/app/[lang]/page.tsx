import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { ScaffolderPage } from '../ui/scaffolder-page'

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  if (!isLocale(lang)) {
    notFound()
  }

  const dictionary = await getDictionary(lang)

  return <ScaffolderPage locale={lang} dictionary={dictionary} />
}
