import Icon from '@/components/Icon'
import Logo from '@/components/Logo'

// A taste of the output — a static sample verdict in the same teal language as
// the real hero, so a first-time visitor sees exactly what hop hands back: not a
// fare list, a decision. Hard-coded, labelled "Sample" so it never reads as live
// data. Flat, solid, no translucency (the dark teal's white text is the one
// allowed exception, matching VerdictRail).
export default function SampleVerdict() {
  return (
    <section
      className="grid grid-cols-1 overflow-hidden rounded-[20px] text-[#eafaf7] lg:grid-cols-[1fr_300px] lg:rounded-[28px]"
      style={{ background: 'var(--color-brand)' }}
    >
      {/* LEFT — the verdict */}
      <div className="px-6 pb-8 pt-7 sm:px-10 lg:px-[44px] lg:pb-10 lg:pt-9">
        <span className="mb-5 inline-flex items-center gap-2 border-b border-white/15 pb-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-[#9fe0d6]">
          Sample verdict
          <span className="rounded-full bg-[#0a5757] px-2 py-[2px] text-[9.5px] tracking-[0.14em] text-[#6ff0d2]">
            SFO → JFK
          </span>
        </span>

        <h3 className="font-display text-[26px] font-semibold leading-[1.06] tracking-[-0.02em] text-white sm:text-[32px] lg:text-[38px]">
          Use your <span className="text-[#ffe7b0]">Alaska miles</span> and save
        </h3>

        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-display text-[58px] font-semibold leading-[0.9] tracking-[-0.04em] text-[#6ff0d2] tabular-nums sm:text-[80px] lg:text-[96px]">
            $243
          </span>
          <span className="font-display text-[18px] font-semibold tracking-[-0.01em] text-[#9fe0d6] sm:text-[22px]">
            vs&nbsp;cash
          </span>
        </div>

        <p className="mt-5 max-w-[44ch] text-[15.5px] leading-[1.55] text-[#c7ece5]">
          <b className="font-semibold text-white">25,000 miles</b> at{' '}
          <b className="font-semibold text-white">2.1¢ each</b> — the best
          redemption across your programs. Cash is{' '}
          <b className="font-semibold text-white">$768</b>. You have the miles.
        </p>

        <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/15 pt-6">
          <Stat label="You pay" value="25,000" unit="miles" />
          <Stat label="Value" value="2.1¢" unit="/ mile" />
          <Stat label="Cash price" value="$768" />
          <Stat label="You save" value="$243" accent />
        </div>
      </div>

      {/* RIGHT — the bunny, the mark in its element */}
      <aside
        className="relative hidden place-items-center overflow-hidden border-l border-white/10 lg:grid"
        style={{ background: 'var(--color-brand-deep)' }}
      >
        <Logo size={150} carve="var(--color-brand-deep)" className="text-white" />
        <span className="absolute bottom-5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6ec9bd]">
          <Icon name="check_circle" size={14} />
          the smarter book
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
      <div className="mb-[5px] text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fcabf]">
        {label}
      </div>
      <div
        className="font-display text-[24px] font-semibold tracking-[-0.01em] tabular-nums"
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
