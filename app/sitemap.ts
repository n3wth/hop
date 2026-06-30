import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo'
import {
  CONTENT_LAST_MODIFIED,
  STATIC_SEO_ROUTES,
} from '@/lib/seo-routes'
import { destinations } from '@/lib/destinations'
import { allPrograms } from '@/lib/sweet-spots'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = STATIC_SEO_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: CONTENT_LAST_MODIFIED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  const sweetSpotPages: MetadataRoute.Sitemap = allPrograms().map((slug) => ({
    url: absoluteUrl(`/sweet-spots/${slug}`),
    lastModified: CONTENT_LAST_MODIFIED,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  const destinationPages: MetadataRoute.Sitemap = destinations.map((d) => ({
    url: absoluteUrl(`/destinations/${d.code.toLowerCase()}`),
    lastModified: CONTENT_LAST_MODIFIED,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...staticPages, ...sweetSpotPages, ...destinationPages]
}
