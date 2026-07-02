'use client'

import { useState } from 'react'
import { cardForProgram, cardOutclickPath } from '@/lib/card-affiliates'
import Icon from './Icon'

export interface CardAffiliateCTAProps {
  /** Free-text program string for the winning award (the pick's `program`). */
  program?: string
  /** The miles/points unit word ("miles" | "points") for honest copy. */
  unit?: string
}

// "Earn the points for this trip" — the affiliate CTA that sits under a
// points-winning verdict (roadmap WS2). Rendered ONLY on points verdicts by the
// caller; here we only gate on whether a card maps to the program. Flat editorial
// on the teal hero: a hairline-bordered row, white/mint text, no shadow/gradient.
// Clearly marked "Sponsored". Locally dismissible; the fade is transform/opacity
// only and frozen under prefers-reduced-motion via the .hop-fade-out helper.
export default function CardAffiliateCTA({ program, unit = 'miles' }: CardAffiliateCTAProps) {
  const [dismissed, setDismissed] = useState(false)

  const card = program ? cardForProgram(program) : undefined
  // Nothing maps (unknown program / hotel / no card) → render nothing.
  if (!card) return null
  if (dismissed) return null

  const bonus = card.bonusMiles > 0 ? card.bonusMiles.toLocaleString() : null

  return (
    <div
      className="hop-rise mt-5 flex items-start gap-3 rounded-[14px] border-[1.5px] border-white/15 bg-white/[0.04] px-4 py-[14px]"
      style={{ ['--hop-delay' as string]: '260ms' }}
    >
      <span aria-hidden className="mt-[2px] flex-shrink-0 text-hero-label">
        <Icon name="credit_card" size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-hero-label">
          Sponsored
        </div>
        {/* Outbound clicks route through the first-party redirect (logged,
            then 302 to the issuer). rel="sponsored noopener": network
            compliance + correct SEO signal for an affiliate link. */}
        <a
          href={cardOutclickPath(card.id, program)}
          target="_blank"
          rel="sponsored noopener"
          className="group inline-flex flex-wrap items-baseline gap-x-[6px] text-[14px] leading-[1.5] text-hero-body transition-colors hover:text-white"
        >
          <span>
            {bonus ? (
              <>
                Earn <b className="font-semibold text-white">{bonus} {unit}</b> with the{' '}
              </>
            ) : (
              <>Earn {unit} with the </>
            )}
            <b className="font-semibold text-white">{card.cardName}</b>
            {card.bonusSpend ? (
              <span className="text-hero-label">
                {' '}
                after ${card.bonusSpend.toLocaleString()} spend
              </span>
            ) : null}
          </span>
          <span aria-hidden className="text-mint-bright transition-transform group-hover:translate-x-[2px]">
            →
          </span>
        </a>
        <p className="mt-[5px] text-[12px] leading-[1.45] text-hero-label">{card.note}</p>
        {/* Advertiser disclosure the affiliate networks require — one plain,
            muted line. Same hero-label token as the note (AA on the teal hero). */}
        <p className="mt-[6px] text-[12px] leading-[1.45] text-hero-label">
          If you&rsquo;re approved, hop may earn a commission. Terms apply.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss card offer"
        className="-mr-1 -mt-1 flex-shrink-0 rounded-lg p-1 text-hero-label transition-colors hover:text-white"
      >
        <Icon name="close" size={20} />
      </button>
    </div>
  )
}
