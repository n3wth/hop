'use client'

import { usePathname } from 'next/navigation'
import { FOOTER_SECTIONS } from '@/lib/seo-routes'

export default function FooterNav() {
  const pathname = usePathname()

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 sm:gap-x-8">
      {FOOTER_SECTIONS.map((section) => (
        <nav key={section.title} aria-labelledby={`footer-${section.title.toLowerCase()}`}>
          <h2
            id={`footer-${section.title.toLowerCase()}`}
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text2"
          >
            {section.title}
          </h2>
          <ul className="mt-2.5 space-y-2">
            {section.links.map((link) => {
              const linkPath = link.href.split('#')[0]
              const active = pathname === linkPath
              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'font-semibold text-text'
                        : 'text-text2 transition-colors hover:text-text'
                    }
                  >
                    {link.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      ))}
    </div>
  )
}
