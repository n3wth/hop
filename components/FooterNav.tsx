'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { FOOTER_SECTIONS } from '@/lib/seo-routes'
import Eyebrow from '@/components/ui/Eyebrow'

export default function FooterNav() {
  const pathname = usePathname()

  return (
    <div className="grid grid-cols-3 gap-x-6 gap-y-5 lg:gap-x-10">
      {FOOTER_SECTIONS.map((section) => (
        <nav key={section.title} aria-labelledby={`footer-${section.title.toLowerCase()}`}>
          <Eyebrow
            as="h2"
            id={`footer-${section.title.toLowerCase()}`}
            className="text-[11px] text-text2"
          >
            {section.title}
          </Eyebrow>
          <ul className="mt-2.5 space-y-2">
            {section.links.map((link) => {
              const linkPath = link.href.split('#')[0]
              const active = pathname === linkPath
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'font-semibold text-text'
                        : 'text-text2 transition-colors hover:text-text'
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      ))}
    </div>
  )
}
