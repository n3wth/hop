import type { MetadataRoute } from 'next'
import { SITE_NAME, DEFAULT_DESCRIPTION, TEAL, CREAM } from '@/lib/seo'

// PWA-lite manifest. themeColor lives in the viewport export (layout), not here.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: CREAM,
    theme_color: TEAL,
    icons: [
      {
        src: '/icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        type: 'image/png',
        sizes: '180x180',
      },
    ],
  }
}
