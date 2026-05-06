import type { Metadata } from "next";
import "./globals.css";
import { geist, geistMono } from "./ui/fonts";
import { Suspense } from "react";
import { ThemeProvider } from "./ui/theme-provider";
import { Toaster } from '@/components/ui/sonner'

export const metadataBase = new URL("https://scaffolder.teamofey.tech/");

export const metadata: Metadata = {

  title: "Frontend Scaffolder - Создайте проект за секунды",
  description: "Современный инструмент для генерации структуры frontend проектов",
  metadataBase: new URL("https://scaffolder.teamofey.tech/"),
  openGraph: {
    siteName: "Frontend Scaffolder",
    url: "https://scaffolder.teamofey.tech/",
    images: [
      {
        url: "/main-image.png",
        width: 1200,
        height: 630,
        alt: "Frontend Scaffolder — превью",
      },
    ],
    locale: "ru_RU",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geist.className} ${geistMono.className} antialiased`}
      >
        <Suspense>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
            <Toaster richColors />
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
