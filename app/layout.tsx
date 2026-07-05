import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Bricolage_Grotesque, Fraunces, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  TEAL,
} from '@/lib/seo'
import StructuredData from '@/components/StructuredData'
import ScrollToTop from '@/components/ScrollToTop'
import PostHogBoot from '@/components/PostHogBoot'
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
    // 'default' (not 'black-translucent'): hop is a light-themed app (warm
    // cream canvas, no dark hero spanning the top of every page) — per Apple's
    // own guidance and PWA convention, 'black-translucent' (transparent bar,
    // white icons) is for apps with a dark top-of-viewport; on a light canvas
    // it renders illegible white-on-cream icons. 'default' (white bar, dark
    // icons) is the documented, low-risk fit here — see
    // node_modules/next/dist/docs/.../generate-metadata.md#applewebapp.
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
  // Next's `appleWebApp.capable` only emits the unprefixed
  // `mobile-web-app-capable` (Chromium's preferred tag, since Next 15 —
  // github.com/vercel/next.js PR #70272 dropped the Apple-prefixed one to
  // silence a Chrome DevTools deprecation warning). But Apple's own docs
  // (Configuring Web Applications: "apple-mobile-web-app-status-bar-style
  // ... has no effect unless you first specify standalone mode [via
  // apple-mobile-web-app-capable]") still key iOS standalone/status-bar
  // behavior off the *prefixed* tag on pre-Safari-26 iOS — its absence is
  // exactly what makes an installed hop look like a bare Safari tab instead
  // of a native app shell (vercel/next.js issues #70272, #74248, #74524).
  // Emit both via `other` (Next's documented custom-meta-tag escape hatch)
  // so iOS gets the tag it actually keys standalone/status-bar behavior on.
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  // Single value, not the {media, color}[] form: hop declares colorScheme
  // 'light' only (no dark theme), so there's no second variant to branch on —
  // see generate-viewport.md#themecolor for when the array form is needed.
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
        <Analytics />
        {/* PostHog product analytics (R0.5) — init + pageviews on every page;
            AppShell adds identify() for signed-in sessions. No-ops without
            NEXT_PUBLIC_POSTHOG_KEY. */}
        <PostHogBoot />
        {/* Travelpayouts auto-attribution tag (project/trs 545389, marker
            745576). Decorates clicks on links that point DIRECTLY at partner
            domains. It cannot see through the same-origin /api/go/kiwi ledger
            redirect, so the cash CTAs do NOT rely on it — lib/booking.ts
            #cashBookingUrl bakes attribution into the redirect destination
            (tp.media). The tag stays for any other partner links on the page.
            lazyOnload keeps it entirely off the critical path. No hop data is
            sent; it only decorates outbound partner navigations. Production-only:
            the tag 403s on non-whitelisted origins (localhost), spamming the
            console — and dev clicks shouldn't attribute anyway. */}
        {process.env.NODE_ENV === 'production' && (
          <Script src="https://emrldtp.com/NTQ1Mzg5.js?t=545389" strategy="lazyOnload" />
        )}
      </body>
    </html>
  )
}
