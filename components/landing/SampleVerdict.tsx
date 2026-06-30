import Icon from '@/components/Icon'
import Logo from '@/components/Logo'
import { destinationImage } from '@/lib/images'

// A taste of the output — a static sample verdict in the same teal language as
// the real hero, so a first-time visitor sees exactly what hop hands back: not a
// fare list, a decision. Hard-coded, labelled "Sample" so it never reads as live
// data. The right panel shows the destination (New York, the sample's JFK) so it
// mirrors the real verdict hero. Flat, solid, no translucency (the dark teal's
// white text is the one allowed exception, matching VerdictRail).
export default async function SampleVerdict() {
  const photo = await destinationImage('New York City skyline travel landmark')
  return (
    <section
      className="grid grid-cols-1 overflow-hidden rounded-[20px] text-hero-cream lg:grid-cols-[1fr_300px] lg:rounded-[28px]"
      style={{ background: 'var(--color-brand)' }}
    >
      {/* LEFT — the verdict */}
      <div className="px-6 pb-8 pt-7 sm:px-10 lg:px-[44px] lg:pb-10 lg:pt-9">
        <span className="mb-5 inline-flex flex-wrap items-center gap-2 border-b border-white/15 pb-3">
          <span className="rounded-full border border-white/25 px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">
            Sample verdict
          </span>
          <span className="rounded-full bg-brand-deep px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.14em] text-mint-bright">
            SFO → JFK
          </span>
        </span>

        <h3 className="font-display-bold text-[26px] leading-[1.06] tracking-[-0.02em] text-white sm:text-[32px] lg:text-[38px]">
          Use <span className="text-gold-soft">Alaska miles</span> and save
        </h3>

        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-display-bold text-[58px] leading-[0.9] tracking-[-0.04em] text-mint-bright tabular-nums sm:text-[80px] lg:text-[96px]">
            $243
          </span>
          <span className="font-display text-[18px] font-semibold tracking-[-0.01em] text-[#9fe0d6] sm:text-[22px]">
            vs&nbsp;cash
          </span>
        </div>

        <p className="mt-5 max-w-[44ch] text-[15.5px] leading-[1.55] text-hero-body">
          <b className="font-semibold text-white">25,000 miles</b> at{' '}
          <b className="font-semibold text-white">2.1¢/pt</b> — the best
          redemption in this example. Cash is{' '}
          <b className="font-semibold text-white">$768</b>, so points win.
        </p>

        <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/15 pt-6">
          <Stat label="You pay" value="25,000" unit="miles" />
          <Stat label="Value" value="2.1¢" unit="/ pt" />
          <Stat label="Cash price" value="$768" />
          <Stat label="You save" value="$243" accent />
        </div>
      </div>

      {/* RIGHT — the destination (New York), mirroring the real verdict hero.
          Falls back to the bunny mark when no photo is available. */}
      <aside
        className="relative hidden place-items-center overflow-hidden border-l border-white/10 lg:grid"
        style={{ background: 'var(--color-brand-deep)' }}
      >
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.alt}
              loading="lazy"
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
        <span className="absolute bottom-5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
          <Icon name="check_circle" size={14} />
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
      <div className="mb-[5px] text-[11px] font-semibold uppercase tracking-[0.16em] text-hero-label">
        {label}
      </div>
      <div
        className="font-display-bold text-[24px] tracking-[-0.01em] tabular-nums"
        style={{ color: accent ? '#6ff0d2' : '#fff' }}
      >
        {value}
        {unit ? (
          <small className="text-[13px] font-medium text-[#9fe0d6]"> {unit}</small>
        ) : null}
      </div>
    </div>
  )
}
