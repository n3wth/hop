import type { ReactNode } from 'react'

interface LegalShellProps {
  eyebrow: string
  title: string
  intro: string
  // When true, render the counsel-review + last-updated notice. Use on the
  // legal pages (terms, privacy); omit on support/values which are not contracts.
  draft?: boolean
  children: ReactNode
}

// Long-form reading layout for legal/support/educational pages. Constrained
// measure (~70ch), display headings, generous spacing, flat brand tokens.
// Body styling is applied via the `.legal-prose` scope in globals.css so the
// page files stay as plain semantic HTML.
export default function LegalShell({ eyebrow, title, intro, draft, children }: LegalShellProps) {
  return (
    <div className="mx-auto max-w-[72ch] px-1">
      <header className="pt-10 sm:pt-14">
        <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-brand">
          {eyebrow}
        </span>
        <h1 className="mt-3 font-display text-[36px] font-bold leading-[1.08] text-text sm:text-[46px]">
          {title}
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-text2">{intro}</p>
      </header>

      {draft ? (
        <div className="mt-7 rounded-lg border border-border bg-paper px-5 py-4 text-[13px] leading-relaxed text-text2">
          <p className="font-semibold text-text">[Last updated: replace before launch]</p>
          <p className="mt-1.5">
            This is a good-faith starter document, not legal advice. It has not been reviewed by a
            lawyer. Have counsel review and adapt it before relying on it. Items in
            [BRACKETS] need the owner&rsquo;s input.
          </p>
        </div>
      ) : null}

      <div className="legal-prose mt-9 text-[16px] leading-[1.7] text-text2">{children}</div>
    </div>
  )
}
