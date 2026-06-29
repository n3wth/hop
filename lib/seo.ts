// Shared SEO constants. Single source of truth for the production origin,
// default title/description/tagline, and brand colors used across the
// Metadata API (layout), the OG image, the manifest, robots, and sitemap.
//
// metadataBase / canonical / OG urls must point at the PROD origin, never the
// localhost APP_BASE_URL the Auth0 SDK uses. Override with NEXT_PUBLIC_SITE_URL
// for preview deploys; otherwise fall back to prod.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://hop.n3wth.com'

export const SITE_NAME = 'hop'

// Strong, on-brand default. Confident, terse — your personal travel agent.
// No emoji, no marketing slop.
export const DEFAULT_TITLE = 'hop — your personal travel agent'

// ~150 chars. What hop actually does, in plain language.
export const DEFAULT_DESCRIPTION =
  'Your personal travel agent that knows your points, reads real award availability and cash fares, and gives you the verdict on what actually wins.'

// One line for the social card.
export const TAGLINE = 'Your personal travel agent'

// Brand palette.
export const TEAL = '#0d6e6e'
export const CREAM = '#f3f1ec'
export const INK = '#19545d'

// Per-page metadata helper. Next 16 merges metadata SHALLOWLY across
// layout → page, so a page that sets `openGraph` (or `alternates`) without
// restating title/description/url inherits the root '/' canonical and the
// homepage social card. This composes a complete, self-contained block per
// sub-page: a route-specific canonical, plus an OG/Twitter card that carries
// the page's own title + description. `title` is the bare child title — the
// root layout's `template` ('%s · hop') appends the suffix, so do NOT add
// '· hop' here. Exported for the route lanes to use.
export function pageMeta({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}) {
  const canonical = path.startsWith('/') ? path : `/${path}`
  const url = `${SITE_URL}${canonical === '/' ? '' : canonical}`
  // OG/Twitter want the fully-resolved title (template doesn't apply to them).
  const cardTitle = `${title} · ${SITE_NAME}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website' as const,
      siteName: SITE_NAME,
      url,
      title: cardTitle,
      description,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: cardTitle,
      description,
    },
  }
}
