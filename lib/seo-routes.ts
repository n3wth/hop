import type { MetadataRoute } from 'next'

// Bump this date when you change destinations, sweet-spots, or other SEO content
// datasets. The sitemap reads it as lastModified so crawlers see a real refresh
// without churning on every unrelated deploy. After bumping, the weekly SEO cron
// (or a manual GET /api/cron/revalidate-seo) invalidates cached pages.
export const CONTENT_LAST_MODIFIED = '2026-07-15'

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>

export interface StaticSeoRoute {
  path: string
  changeFrequency: ChangeFrequency
  priority: number
}

// Indexable public routes — keep in sync with robots.ts allow rules. Omit
// noindex surfaces (/login, /book, /account, /book/confirmation).
export const STATIC_SEO_ROUTES: StaticSeoRoute[] = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/search', changeFrequency: 'daily', priority: 0.9 },
  { path: '/deals', changeFrequency: 'daily', priority: 0.8 },
  { path: '/destinations', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/sweet-spots', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/guides', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/guides/point-value', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/guides/points-101', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/points', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/ask', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/pricing', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/mcp', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/stats', changeFrequency: 'weekly', priority: 0.4 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/credits', changeFrequency: 'yearly', priority: 0.2 },
]

export interface NavLink {
  href: string
  label: string
}

// Primary app nav — shared by TopNav desktop + mobile menu.
export const PRIMARY_NAV: NavLink[] = [
  { href: '/search', label: 'Search' },
  { href: '/deals', label: 'Deals' },
  { href: '/ask', label: 'Ask' },
  { href: '/pricing', label: 'Pricing' },
]

export interface FooterSection {
  title: string
  links: NavLink[]
}

// Footer link mesh — grouped for semantics and crawlability. Every href here is
// indexable and should appear in STATIC_SEO_ROUTES or a dynamic content tree.
export const FOOTER_SECTIONS: FooterSection[] = [
  {
    title: 'Explore',
    links: [
      { href: '/search', label: 'Search flights' },
      { href: '/deals', label: 'Deals' },
      { href: '/destinations', label: 'Destination guides' },
      { href: '/sweet-spots', label: 'Sweet spots' },
      { href: '/ask', label: 'Ask hop' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { href: '/guides', label: 'Program guides' },
      { href: '/guides/points-101', label: 'New to points? Start here' },
      { href: '/guides/point-value', label: 'How we value points' },
      { href: '/mcp', label: 'Use hop from your AI agent' },
      { href: '/support', label: 'Support' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/credits', label: 'Photo credits' },
      { href: 'mailto:hop@n3wth.com', label: 'Contact' },
    ],
  },
]

// Paths the weekly SEO cron revalidates. Dynamic trees (destinations/*,
// sweet-spots/*) regenerate on the next request after their parent revalidates.
export const SEO_REVALIDATE_PATHS: string[] = [
  '/',
  '/search',
  '/deals',
  '/destinations',
  '/sweet-spots',
  '/guides',
  '/guides/point-value',
  '/guides/points-101',
  '/ask',
  '/pricing',
  '/mcp',
  '/support',
  '/privacy',
  '/terms',
]
