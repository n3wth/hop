import type { MetadataRoute } from 'next'
import { absoluteUrl, SITE_URL } from '@/lib/seo'

// Allow crawling of public routes; keep API, auth, the booking confirmation,
// and the private account surface out of the index. /book itself is crawlable
// (it's in the sitemap) — only /book/confirmation is excluded.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/book/confirmation', '/account'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  }
}
