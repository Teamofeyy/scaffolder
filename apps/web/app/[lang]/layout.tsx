import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Toaster } from "@/components/ui/sonner"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { isLocale, locales } from "@/lib/i18n/config"
import { geist, geistMono } from "../ui/fonts"
import { ThemeProvider } from "../ui/theme-provider"
import "../globals.css"

type LayoutProps = Readonly<{
  children: React.ReactNode
  params: Promise<{ lang: string }>
}>

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export async function generateMetadata({
  params,
}: Pick<LayoutProps, "params">): Promise<Metadata> {
  const { lang } = await params

  if (!isLocale(lang)) {
    return {}
  }

  const dictionary = await getDictionary(lang)

  return {
    title: dictionary.metadata.title,
    description: dictionary.metadata.description,
    metadataBase: new URL("https://scaffolder.teamofey.tech/"),
    alternates: {
      canonical: `/${lang}`,
      languages: {
        ru: "/ru",
        en: "/en",
      },
    },
    openGraph: {
      siteName: "Frontend Scaffolder",
      url: `/${lang}`,
      images: [
        {
          url: "/main-image.png",
          width: 1200,
          height: 630,
          alt: "Frontend Scaffolder",
        },
      ],
      locale: lang === "ru" ? "ru_RU" : "en_US",
      alternateLocale: lang === "ru" ? ["en_US"] : ["ru_RU"],
      type: "website",
    },
  }
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { lang } = await params

  if (!isLocale(lang)) {
    notFound()
  }

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={`${geist.className} ${geistMono.className} antialiased`}>
        <Suspense>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors />
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  )
}
