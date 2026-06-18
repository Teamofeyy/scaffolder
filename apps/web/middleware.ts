import { NextRequest, NextResponse } from "next/server"
import { defaultLocale, locales } from "@/lib/i18n/config"

function pathnameHasLocale(pathname: string) {
  return locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathnameHasLocale(pathname)) {
    return NextResponse.next()
  }

  request.nextUrl.pathname = `/${defaultLocale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
