'use client'

import { useState } from 'react'
import { cardForProgram, cardOutclickPath } from '@/lib/card-affiliates'
import { track } from '@/lib/posthog-client'
import Eyebrow from './ui/Eyebrow'
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

  const bonus = card.bonusMiles > 0 ? card.bonusMiles.toLocaleString('en-US') : null

  return (
    // A hairline top divider (distinct from the bordered box below it) keeps
    // this monetized module visually separate from the computed verdict math
    // above it — the stat row is hop's number, this is a paid placement, and
    // the two should never read as one continuous block. Mobile gaps (mt-7/
    // pt-6) match the hero's other section breaks so the left panel keeps one
    // vertical rhythm at 375.
    <div
      className="hop-rise mt-7 border-t border-white/10 pt-6 sm:mt-5 sm:pt-5"
      style={{ ['--hop-delay' as string]: '260ms' }}
    >
      <div className="flex items-start gap-2.5 rounded-[14px] border-[1.5px] border-white/15 bg-white/[0.04] px-3.5 py-3 sm:gap-3 sm:px-4 sm:py-[14px]">
        {/* leading glyph — desktop garnish only; at 375 its column steals
            headline width and forces awkward wraps. */}
        <span aria-hidden className="mt-[2px] hidden flex-shrink-0 text-hero-label sm:block">
          <Icon name="credit_card" size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <Eyebrow as="div" onDark className="mb-1 text-[10px]">
            Sponsored
          </Eyebrow>
          {/* Outbound clicks route through the first-party redirect (logged,
              then 302 to the issuer). rel="sponsored noopener": network
              compliance + correct SEO signal for an affiliate link. */}
          <a
            href={cardOutclickPath(card.id, program)}
            target="_blank"
            rel="sponsored noopener"
            onClick={() => track('outclick', { kind: 'card', target: card.id })}
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
                  after ${card.bonusSpend.toLocaleString('en-US')} spend
                </span>
              ) : null}
            </span>
            <span aria-hidden className="text-mint-bright">
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

        {/* Dismiss — pinned top-right, negative margins keep the visual inset
            tight while p-1.5 keeps the tap target ~32px on phones. */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss card offer"
          className="-mr-1.5 -mt-1.5 flex-shrink-0 rounded-lg p-1.5 text-hero-label transition-colors hover:text-white"
        >
          <Icon name="close" size={20} />
        </button>
      </div>
    </div>
  )
}
