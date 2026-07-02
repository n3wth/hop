'use client'

// AskStart — the /ask empty-state GREETING, a calm cream editorial start.
//
// This is presentational only: a small brand eyebrow, a display heading, a
// one-line subhead, and an optional slim destination strip that seeds a starter
// prompt on tap. It carries NO composer and NO starter chips — those live in the
// concierge's shared dock (components/Concierge), docked at the floor in BOTH the
// empty and thread states, so sending the first message swaps only this greeting
// for the streamed conversation with zero layout jump. The concierge centers this
// block vertically inside the single scroll region.
//
// Flat + on-brand: paper elements on the cream canvas, brand tokens, hover = color
// only, motion is reduced-motion-safe (.hop-rise is inert). No dark backdrop, no
// mood gallery. Copy comes from lib/concierge-hero (one voice, shared with home).

// A slim destination tile — a small rounded thumbnail that seeds a starter prompt
// on tap. Serializable (the server already passes this shape down to Concierge).
export interface AskStartDestination {
  city: string
  thumb: string
  alt: string
  countryCode: string
}

export interface AskStartProps {
  /** Resolved copy from lib/concierge-hero (one source, shared with the home). */
  eyebrow: string
  heading: string
  /** The canonical subhead — for signed-in visitors this states their points
   *  number ("With ~40,000 points…"). Shared with the home so the two never drift. */
  sub: string
  /** Send a destination-tile prompt straight through (wired to useChat). */
  onStarter: (prompt: string) => void
  /** Optional quiet destination strip; omit for a greeting-only start. */
  destinations?: AskStartDestination[]
}

export default function AskStart({
  eyebrow,
  heading,
  sub,
  onStarter,
  destinations = [],
}: AskStartProps) {
  return (
    <div
      className="hop-rise hop-ask-measure flex flex-col items-center text-center"
      style={{ ['--hop-delay' as string]: '40ms' }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand sm:text-[12px]">
        {eyebrow}
      </span>

      <h1 className="mt-4 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] text-text sm:text-[40px]">
        {heading}
      </h1>

      <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.6] text-text2 sm:text-[16px]">
        {sub}
      </p>

      {/* a quiet accent: a slim strip of paper destination thumbnails. Captions
          sit BELOW the photo (no scrim needed), keeping it flat and editorial.
          Tapping one seeds a starter prompt — inspiration, not a dark gallery. */}
      {destinations.length ? (
        <div className="mt-8 flex w-full flex-wrap justify-center gap-2.5">
          {destinations.map((d) => (
            <button
              key={d.city}
              type="button"
              onClick={() => onStarter(`Cheapest way to ${d.city}`)}
              aria-label={`Cheapest way to ${d.city}`}
              className="hop-press group flex w-[92px] flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-paper transition-colors hover:border-brand"
            >
              <span className="block h-14 w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.thumb}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="flex items-center gap-1 px-2 py-1.5">
                <span
                  className={`fi fi-${d.countryCode} h-[9px] w-[13px] flex-shrink-0 rounded-[1px]`}
                  aria-hidden
                />
                <span className="truncate text-[11px] font-medium text-text2 transition-colors group-hover:text-brand">
                  {d.city}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
