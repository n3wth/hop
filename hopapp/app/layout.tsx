import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'hop — the verdict',
  description: 'Points vs cash flight optimizer',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Display + wordmark: Bricolage Grotesque (Google Fonts — not on
            Fontshare). Body/UI: General Sans (Fontshare). Loaded by <link>
            since next/font has no Fontshare provider. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  )
}
