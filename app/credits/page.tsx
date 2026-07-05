import type { Metadata } from 'next'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import { DESTINATION_PHOTOS } from '@/lib/destination-photos'

export const metadata: Metadata = {
  title: 'Photo credits · hop',
  description: 'The photographers behind hop’s destination imagery.',
}

// Attribution page for the self-hosted destination photography. Wikimedia
// Commons photos are CC-licensed — visible attribution is a LICENSE
// REQUIREMENT, not a courtesy; Pexels asks only for appreciation. Grouped by
// source, linked to each photographer/photo page.
export default function CreditsPage() {
  const entries = Object.entries(DESTINATION_PHOTOS).sort((a, b) =>
    a[1].city.localeCompare(b[1].city),
  )
  const commons = entries.filter(([, p]) => p.credit.source === 'Wikimedia Commons')
  const pexels = entries.filter(([, p]) => p.credit.source === 'Pexels')

  return (
    <AppShell user={null} hideSearch>
      <div className="mx-auto max-w-[var(--container-sm)] px-2 pb-8 pt-6 sm:pt-10">
        <h1 className="font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] text-text sm:text-[40px]">
          Photo credits
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.6] text-text2">
          The destination photography across hop comes from these photographers.
          Wikimedia Commons photos are used under their Creative Commons
          licenses; Pexels photos under the Pexels License.
        </p>

        {[
          ['Wikimedia Commons', commons],
          ['Pexels', pexels],
        ].map(([title, group]) => (
          <section key={title as string} className="mt-10">
            <h2 className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
              {title as string}
            </h2>
            <ul className="mt-3 divide-y divide-hair">
              {(group as typeof entries).map(([code, p]) => (
                <li key={code} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5">
                  <span className="w-[10ch] flex-shrink-0 font-display text-[15px] font-semibold text-text">
                    {p.city}
                  </span>
                  <a
                    href={p.credit.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-text2 underline decoration-border underline-offset-2 transition-colors hover:text-brand"
                  >
                    {p.credit.name}
                  </a>
                  <span className="text-[12px] text-text3">{p.credit.license}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-10 text-[13.5px] text-text2">
          Photography elsewhere on hop may come from{' '}
          <a
            href="https://unsplash.com/?utm_source=hop&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-border underline-offset-2 transition-colors hover:text-brand"
          >
            Unsplash
          </a>
          , credited where it appears.{' '}
          <Link href="/" className="font-semibold text-brand transition-colors hover:text-brand-deep">
            Back to hop →
          </Link>
        </p>
      </div>
      <div className="mx-auto max-w-[var(--container-shell)]">
        <SiteFooter />
      </div>
    </AppShell>
  )
}
