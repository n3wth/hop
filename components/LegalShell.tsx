import type { ReactNode } from 'react'

interface LegalShellProps {
  eyebrow: string
  title: string
  intro: string
  // When set, render a "Last updated" line. Use on the legal pages (terms,
  // privacy); omit on support, which is not a contract.
  lastUpdated?: string
  children: ReactNode
}

// Long-form reading layout for legal/support/educational pages. Constrained
// measure (~70ch), display headings, generous spacing, flat brand tokens.
// Body styling is applied via the `.legal-prose` scope in globals.css so the
// page files stay as plain semantic HTML.
export default function LegalShell({ eyebrow, title, intro, lastUpdated, children }: LegalShellProps) {
  return (
    <div className="mx-auto max-w-[72ch] px-1">
      <header className="pt-10 sm:pt-14">
        <span className="text-[12px] font-bold uppercase tracking-[var(--track-eyebrow)] text-brand">
          {eyebrow}
        </span>
        <h1 className="mt-3 font-display text-[36px] font-bold leading-[1.08] text-text sm:text-[46px]">
          {title}
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-text2">{intro}</p>
      </header>

      {lastUpdated ? (
        <p className="mt-7 text-[13px] font-semibold text-text2">Last updated: {lastUpdated}</p>
      ) : null}

      <div className="legal-prose mt-9 text-[16px] leading-[1.7] text-text2">{children}</div>
    </div>
  )
}
