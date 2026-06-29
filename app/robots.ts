import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// Allow crawling of public routes; keep private/auth/api surfaces out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/auth', '/api'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
