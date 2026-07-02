import { essentials, dollarSignal, fxAsOf } from '@/lib/place-info'

// Real, looked-up facts for a destination — currency, language, local time —
// plus a computed "how far your dollar goes" line. All from the committed
// place-facts snapshot (Wikidata + Frankfurter), date-stamped, never generated.
// Renders nothing when we hold no facts for the destination.
export default function Essentials({ code }: { code: string }) {
  const e = essentials(code)
  const dollar = dollarSignal(code)
  if (!e.currency && !e.language && !e.utcOffset && !dollar) return null

  const labelClass = 'text-[10px] font-semibold uppercase tracking-[var(--track-label)] text-text3'

  return (
    <section className="mt-8">
      <h2 className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">Essentials</h2>
      <dl className="mt-4 grid grid-cols-3 gap-4">
        {e.currency && (
          <div>
            <dt className={labelClass}>Currency</dt>
            <dd className="mt-1 text-[16px] leading-snug text-text">
              <span className="font-semibold">{e.currency.symbol}</span>{' '}
              <span className="text-text2">{e.currency.name}</span>
            </dd>
          </div>
        )}
        {e.language && (
          <div>
            <dt className={labelClass}>Language</dt>
            <dd className="mt-1 text-[16px] leading-snug text-text">{e.language}</dd>
          </div>
        )}
        {e.utcOffset && (
          <div>
            <dt className={labelClass}>Local time</dt>
            <dd className="mt-1 text-[16px] leading-snug tabular-nums text-text">{e.utcOffset}</dd>
          </div>
        )}
      </dl>

      {dollar && (
        <p className="mt-4 border-t border-hair pt-4 text-[14.5px] leading-relaxed text-text2">
          <span className="font-semibold text-text">How far your dollar goes.</span> {dollar}{' '}
          <span className="text-text3">Rates {fxAsOf()}, via the ECB.</span>
        </p>
      )}
    </section>
  )
}
