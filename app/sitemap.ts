import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo'

// Public routes for crawlers. lastModified is a fixed ISO string (not
// Date.now()) so the sitemap is deterministic across builds and doesn't churn
// every deploy. Private surfaces (/book/confirmation, /account) are excluded
// from the index in robots.ts but a few are still listed here as entry points.
const LASTMOD = '2026-06-30'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl('/'), lastModified: LASTMOD, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/search'), lastModified: LASTMOD, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/deals'), lastModified: LASTMOD, changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/ask'), lastModified: LASTMOD, changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl('/book'), lastModified: LASTMOD, changeFrequency: 'weekly', priority: 0.5 },
    { url: absoluteUrl('/login'), lastModified: LASTMOD, changeFrequency: 'monthly', priority: 0.4 },
    { url: absoluteUrl('/support'), lastModified: LASTMOD, changeFrequency: 'monthly', priority: 0.4 },
    { url: absoluteUrl('/privacy'), lastModified: LASTMOD, changeFrequency: 'yearly', priority: 0.3 },
    { url: absoluteUrl('/terms'), lastModified: LASTMOD, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
