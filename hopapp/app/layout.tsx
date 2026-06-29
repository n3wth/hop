import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Fraunces, Geist } from 'next/font/google'
import { Suspense } from 'react'
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  TEAL,
} from '@/lib/seo'
import { Analytics } from '@vercel/analytics/next'
import { PostHogClientProvider } from '@/components/PostHogProvider'
import { PostHogPageView } from '@/components/PostHogPageView'
import './globals.css'

// Display headlines: Bricolage Grotesque via next/font/google — self-hosted, preloaded.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-bricolage',
  display: 'swap',
})

// Wordmark: Fraunces italic — modern characterful serif that leans forward,
// echoing the leaping bunny's upward motion. One designed lockup, not icon+label.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
  style: ['italic'],
  variable: '--font-wordmark',
  display: 'swap',
})

// Body/UI: Geist Sans via next/font/google — self-hosted, preloaded, no external requests.
const geistSans = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-geist-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: '%s · hop',
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'hop' }],
  keywords: [
    'points vs cash',
    'award flights',
    'flight points optimizer',
    'miles redemption',
    'frequent flyer',
    'AwardWallet',
    'award travel',
    'flight deals',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  themeColor: TEAL,
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${fraunces.variable} ${geistSans.variable}`}>
      <head>
        {/* Body/UI: General Sans (Fontshare — not on Google/next-font). */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <PostHogClientProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          {children}
        </PostHogClientProvider>
      </body>
    </html>
  )
}
