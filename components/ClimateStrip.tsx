import Card from '@/components/ui/Card'
import { MONTH_ABBR, type MonthlyNormals, type Seasonality } from '@/lib/climate'

// A flat 12-month temperature ribbon. Bar height encodes the month's mean temp
// (normalized to the city's own range); color encodes the COMPUTED verdict —
// teal for the best window, amber for a flagged stretch, mint for the rest. No
// shadows/gradients; the data is real (ERA5 normals) and the coloring is derived
// by lib/climate, not chosen by hand. Server-rendered, no client JS.
export default function ClimateStrip({
  normals,
  seasonality,
}: {
  normals: MonthlyNormals
  seasonality: Seasonality
}) {
  const valid = normals.tempF.filter((t): t is number => t != null)
  if (valid.length === 0) return null
  const tmin = Math.min(...valid)
  const tmax = Math.max(...valid)
  const span = tmax - tmin || 1
  const best = new Set(seasonality.bestMonths)
  const avoid = new Set(seasonality.avoidMonths)

  return (
    <figure className="mt-5">
      <Card surface="paper" className="flex items-end gap-1.5 px-3 pb-3 pt-4">
        {normals.tempF.map((t, i) => {
          // 24–100% of the track, so even the coolest month reads as a bar.
          const h = t == null ? 10 : 24 + 76 * ((t - tmin) / span)
          const fill = best.has(i)
            ? 'var(--color-brand)'
            : avoid.has(i)
              ? 'var(--color-ok)'
              : 'var(--color-brand-mint-deep)'
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-[60px] w-full items-end">
                <div
                  className="w-full rounded-[3px]"
                  style={{ height: `${h}%`, background: fill }}
                  title={t != null ? `${MONTH_ABBR[i]} · ${Math.round(t)}°F avg` : MONTH_ABBR[i]}
                  aria-hidden
                />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
                {MONTH_ABBR[i].charAt(0)}
              </span>
            </div>
          )
        })}
      </Card>
      <figcaption className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-text3">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: 'var(--color-brand)' }} aria-hidden />
          Best window
        </span>
        {avoid.size > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: 'var(--color-ok)' }} aria-hidden />
            Worth skipping
          </span>
        )}
        <span className="ml-auto">
          Avg monthly temp · 2010–2020 normals via{' '}
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-border underline-offset-2 hover:text-text2"
          >
            Open-Meteo
          </a>
        </span>
      </figcaption>
    </figure>
  )
}
