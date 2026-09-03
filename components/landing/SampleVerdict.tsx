import Icon from '@/components/Icon'
import CountUp from '@/components/CountUp'
import Logo from '@/components/Logo'
import { destinationImage } from '@/lib/images'

// A taste of the output — a static sample verdict in the same teal language as
// the real hero, so a first-time visitor sees exactly what hop hands back: not a
// fare list, a decision. Hard-coded, labelled "Sample" so it never reads as live
// data — but the FIGURES are the canonical worked example from
// docs/design/copy-spec.md's "Verdict hero" section, and they are exactly what
// the mock fixtures (lib/mock.ts, SFO→LAX round trip) render through the real
// engine: cash $254 RT, Alaska saver 4,500 mi + $11.20 per direction → 9,000
// miles + $22 taxes RT, cpp = (254 − 22.40) × 100 / 9000 = 2.6¢/pt, save
// $254 − $22 ≈ $232. Every number closes on screen (taxes are SHOWN — a
// skeptical points person must be able to reconcile cash − savings = taxes),
// and the route label matches the numbers: believable domestic figures, never
// a transpacific route wearing domestic economics. The right panel shows the
// destination (LA, the example's LAX) mirroring the real verdict hero. Flat,
// solid, no translucency (the dark teal's white text is the one allowed
// exception, matching VerdictRail).
export default async function SampleVerdict() {
  const photo = await destinationImage('Los Angeles skyline palm trees')
  return (
    <section
      className="grid grid-cols-1 overflow-hidden rounded-[20px] text-hero-cream lg:grid-cols-[1fr_300px] lg:rounded-[28px]"
      style={{ background: 'var(--color-brand)' }}
    >
      {/* LEFT — the verdict */}
      <div className="px-6 pb-8 pt-7 sm:px-10 lg:px-[44px] lg:pb-10 lg:pt-9">
        <span className="mb-5 inline-flex flex-wrap items-center gap-2 border-b border-white/15 pb-3">
          <span className="rounded-full border border-white/25 px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[var(--track-tag)] text-white/85">
            Sample verdict
          </span>
          <span className="rounded-full bg-brand-deep px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[var(--track-tag)] text-mint-bright">
            SFO → LAX · Round trip
          </span>
        </span>

        <h3 className="text-balance font-display text-[26px] font-semibold leading-[1.06] tracking-[-0.02em] text-white sm:text-[32px] lg:text-[38px]">
          Use <span className="text-gold-soft">Alaska miles</span> and save
        </h3>

        <div className="mt-2 flex items-baseline gap-3">
          {/* Same arrival as the live hero: the $ figure counts up — but only
              once it scrolls into view, since this card sits below the fold.
              Still the canonical worked example; CountUp just ticks to it. */}
          <CountUp
            className="font-display text-[58px] font-semibold leading-[0.9] tracking-[-0.04em] text-mint-bright tabular-nums sm:text-[80px] lg:text-[96px]"
            value={232}
            format="usd"
            startInView
            delayMs={180}
          />
          <span className="font-display text-[18px] font-semibold tracking-[-0.01em] text-hero-eyebrow sm:text-[22px]">
            vs&nbsp;cash
          </span>
        </div>

        <p className="mt-5 max-w-[44ch] text-[15.5px] leading-[1.55] text-hero-body">
          <b className="font-semibold text-white">9,000 miles</b> +{' '}
          <b className="font-semibold text-white">$22 taxes</b> at{' '}
          <b className="font-semibold text-white">2.6¢/pt</b> — the best
          redemption in this example. Cash is{' '}
          <b className="font-semibold text-white">$254</b>, so points win.
        </p>

        <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/15 pt-6">
          <Stat label="You pay" value="9,000" unit="miles + $22" />
          <Stat label="Value" value="2.6¢" unit="/ pt" />
          <Stat label="Cash price" value="$254" />
        </div>
      </div>

      {/* RIGHT — the destination (Tokyo), mirroring the real verdict hero.
          Falls back to the bunny mark when no photo is available. */}
      <aside
        className="relative hidden place-items-center overflow-hidden border-l border-white/10 lg:grid"
        style={{ background: 'var(--color-brand-deep)' }}
      >
        {photo ? (
          <>
            {/* This card sits just below the fold on a typical laptop viewport
                and is the likely desktop LCP element — same reasoning as
                DestinationGrid: the small thumb is plenty for a ~300px slot
                (the 1080px `regular` is 3-4x the bytes for no visible gain),
                and it must not be lazy (that defers it past the preload
                scanner, delaying LCP on a near-fold image). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumb}
              alt={photo.alt}
              fetchPriority="high"
              decoding="async"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(7,62,62,0) 0%, rgba(7,62,62,0.82) 100%)',
              }}
            />
          </>
        ) : (
          <Logo size={150} carve="var(--color-brand-deep)" className="text-white" />
        )}
        <span className="absolute bottom-5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-white">
          <Icon name="check_circle" size={12} weight="fill" />
          the verdict
        </span>
      </aside>
    </section>
  )
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: string
  unit?: string
  accent?: boolean
}) {
  return (
    <div>
      <div className="mb-[5px] text-[11px] font-semibold uppercase tracking-[var(--track-label)] text-hero-label">
        {label}
      </div>
      <div className={`hop-price text-[24px] ${accent ? 'text-mint-bright' : 'text-white'}`}>
        {value}
        {unit ? (
          <small className="text-[13px] font-medium text-hero-eyebrow"> {unit}</small>
        ) : null}
      </div>
    </div>
  )
}
