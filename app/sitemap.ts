import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// Public, indexable routes only. Private/auth/api are excluded (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  // Legal/support pages rarely change — a stable date avoids churning the
  // sitemap's lastmod every deploy and keeps their priority low.
  const stableLastModified = new Date('2026-01-01')
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/search`, lastModified, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/deals`, lastModified, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/ask`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/support`, lastModified: stableLastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: stableLastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: stableLastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
