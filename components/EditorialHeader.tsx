import type { ReactNode } from 'react'

interface EditorialHeaderProps {
  eyebrow: string
  title: string
  /** Tailwind max-w class that balances the headline's wrap point. */
  titleMaxW?: string
  intro: string
  /** Tailwind max-w class for the intro paragraph's reading measure. */
  introMaxW?: string
  /** Stat line / DegradedNote / anything else that sits below the intro. */
  children?: ReactNode
}

// Shared "eyebrow + centered display headline + intro" header for the
// editorial index pages (destinations, deals, sweet-spots) — one definition
// so a type or spacing tweak lands everywhere instead of three places
// quietly drifting apart.
export default function EditorialHeader({
  eyebrow,
  title,
  titleMaxW = 'max-w-[18ch]',
  intro,
  introMaxW = 'max-w-[50ch]',
  children,
}: EditorialHeaderProps) {
  return (
    <header className="mx-auto max-w-[60ch] pt-10 text-center sm:pt-14">
      <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
        {eyebrow}
      </span>
      <h1
        className={`mx-auto mt-3 ${titleMaxW} text-balance font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-text sm:text-[52px]`}
      >
        {title}
      </h1>
      <p
        className={`mx-auto mt-4 ${introMaxW} text-pretty px-2 text-[16px] leading-relaxed text-text2 sm:px-0 sm:text-[17px]`}
      >
        {intro}
      </p>
      {children}
    </header>
  )
}
