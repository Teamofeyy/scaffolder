import { NextRequest, NextResponse } from "next/server"
import {
  defaultLocale,
  isLocale,
  type Locale,
} from "@/lib/i18n/config"

const LOCALE_COOKIE = "NEXT_LOCALE"
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function pathnameLocale(pathname: string): Locale | null {
  const locale = pathname.split("/")[1]
  return locale && isLocale(locale) ? locale : null
}

function preferredLocale(request: NextRequest): Locale {
  const savedLocale = request.cookies.get(LOCALE_COOKIE)?.value

  if (savedLocale && isLocale(savedLocale)) {
    return savedLocale
  }

  const acceptedLanguages = request.headers
    .get("accept-language")
    ?.split(",")
    .map((entry, index) => {
      const [languageRange, ...parameters] = entry.trim().split(";")
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      )
      const quality = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1

      return {
        language: languageRange.toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      }
    })
    .filter(({ quality }) => quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)

  for (const acceptedLanguage of acceptedLanguages ?? []) {
    const baseLanguage = acceptedLanguage.language.split("-")[0]

    if (isLocale(baseLanguage)) {
      return baseLanguage
    }
  }

  return defaultLocale
}

function rememberLocale(response: NextResponse, locale: Locale) {
  response.cookies.set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  })

  return response
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const locale = pathnameLocale(pathname)

  if (locale) {
    return rememberLocale(NextResponse.next(), locale)
  }

  const detectedLocale = preferredLocale(request)
  request.nextUrl.pathname = `/${detectedLocale}${pathname}`

  return rememberLocale(NextResponse.redirect(request.nextUrl), detectedLocale)
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
