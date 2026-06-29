// Shared site footer — one plain line of intent + grouped utility links.
// Used on every page. Flat: color-only hover, no movement.

const groups: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: 'Product',
    links: [
      { href: '/search', label: 'Search' },
      { href: '/deals', label: 'Deals' },
      { href: '/account', label: 'Account' },
    ],
  },
  {
    label: 'Support',
    links: [
      { href: '/support', label: 'How we value points' },
      { href: '/support', label: 'Help' },
    ],
  },
  {
    label: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
]

export default function SiteFooter() {
  return (
    <footer className="mt-[46px] border-t border-border pt-7 text-[12px] text-text3">
      <div className="flex flex-col gap-7 sm:flex-row sm:justify-between sm:gap-10">
        <div className="max-w-[34ch] leading-[1.5]">
          hop compares{' '}
          <b className="font-semibold text-text2">cash, miles, and transfer partners</b> in one
          search.
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-12 gap-y-6 sm:flex-nowrap sm:justify-end"
        >
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text3">
                {group.label}
              </div>
              {group.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-text2 transition-colors hover:text-text"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </div>
      <div className="mt-7 border-t border-hair pt-5 text-text3">
        © {new Date().getFullYear()} hop
      </div>
    </footer>
  )
}
