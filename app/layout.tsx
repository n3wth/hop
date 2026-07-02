import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Bricolage_Grotesque, Fraunces, Geist_Mono } from 'next/font/google'
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  TEAL,
} from '@/lib/seo'
import StructuredData from '@/components/StructuredData'
import ScrollToTop from '@/components/ScrollToTop'
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

// Tabular mono for all numbers, prices, cpp values, and miles counts.
// Geist Mono's optical geometry reads cleanly at small sizes alongside General Sans.
const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-geist-mono',
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
  category: 'travel',
  authors: [{ name: 'hop' }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'default',
  },
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
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${fraunces.variable} ${geistMono.variable}`}>
      <head>
        {/* Body/UI: General Sans (Fontshare — not on Google/next-font). */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <ScrollToTop />
        <StructuredData />
        {children}
        {/* Travelpayouts auto-attribution tag (project 545389). Monetizes outbound
            clicks to partner sites (the Kiwi cash deep-links in lib/booking.ts) by
            attributing them to hop's affiliate account — WITHOUT this, cash-booking
            clicks earn nothing. lazyOnload keeps it entirely off the critical path
            (attribution happens at click time, not render time). No hop data is
            sent; it only decorates outbound partner navigations. */}
        <Script src="https://emrldtp.com/NTQ1Mzg5.js?t=545389" strategy="lazyOnload" />
      </body>
    </html>
  )
}
