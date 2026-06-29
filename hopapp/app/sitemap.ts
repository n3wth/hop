import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// Public, indexable routes only. Private/auth/api are excluded (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/search`, lastModified, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/deals`, lastModified, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/ask`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
  ]
}
