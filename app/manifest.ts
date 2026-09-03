import type { MetadataRoute } from 'next'
import { SITE_NAME, DEFAULT_DESCRIPTION, TEAL, CREAM } from '@/lib/seo'

// PWA manifest. themeColor lives in the viewport export (layout), not here.
// Hardened for a real installable app: a stable id/scope so re-installs don't
// fork a second icon, OS catalog categories, app shortcuts (the long-press
// quick menu), and a MASKABLE icon so the home-screen tile fills the OS mask
// edge-to-edge instead of being shrunk into a white circle.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'en-US',
    dir: 'ltr',
    categories: ['travel', 'finance'],
    background_color: CREAM,
    theme_color: TEAL,
    prefer_related_applications: false,
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
        purpose: 'any',
      },
      {
        src: '/maskable-icon',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'maskable',
      },
    ],
    // The OS long-press / quick-action menu — hop's core jobs, one tap deep.
    shortcuts: [
      {
        name: 'Search flights',
        short_name: 'Search',
        description: 'Price a route — points vs cash, with the verdict',
        url: '/search',
      },
      {
        name: 'Ask hop',
        short_name: 'Ask',
        description: 'Name a destination, get the verdict',
        url: '/ask',
      },
      {
        name: 'Deals',
        short_name: 'Deals',
        description: 'Where your points stretch furthest right now',
        url: '/deals',
      },
    ],
  }
}
