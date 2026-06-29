// Shared site footer — one tight horizontal row: a short line of intent on the
// left, utility links on the right. Flat, color-only hover, no movement. No
// stacked columns, no copyright line — keeps it low and clean.

const links: { href: string; label: string }[] = [
  { href: '/search', label: 'Search' },
  { href: '/deals', label: 'Deals' },
  { href: '/support', label: 'How we value points' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

export default function SiteFooter() {
  return (
    <footer className="mt-16 flex flex-col gap-4 border-t border-border pt-6 text-[12.5px] text-text3 sm:flex-row sm:items-center sm:justify-between">
      <div className="leading-[1.5]">
        Your personal travel agent that reads your points and tells you the verdict.
      </div>
      <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-text2 transition-colors hover:text-text"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  )
}
