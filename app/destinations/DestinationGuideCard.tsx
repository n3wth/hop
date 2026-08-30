import Link from 'next/link'
import Card from '@/components/ui/Card'
import type { Destination } from '@/lib/destinations'
import { computeCpp } from '@/lib/destinations'
import type { DestImage } from '@/lib/images'
import { TierChip } from '@/components/ui/TierChip'

function compactMiles(n: number): string {
  const k = n / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}

function sentenceCase(s: string): string {
  const t = s.trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

export default function DestinationGuideCard({
  dest,
  photo,
}: {
  dest: Destination
  photo?: DestImage | null
}) {
  const value = computeCpp(dest)

  return (
    <Link href={`/destinations/${dest.code.toLowerCase()}`}>
      <Card
        surface="paper"
        radius="lg"
        interactive
        className="group flex min-w-0 flex-col overflow-hidden"
      >
      {/* photo header */}
      <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ background: 'var(--color-brand-deep)' }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.thumb}
            alt={photo.alt}
            loading="lazy"
            width={640}
            height={400}
            className="h-full w-full object-cover"
          />
        ) : (
          <div aria-hidden className="h-full w-full" style={{ background: 'var(--color-brand-deep)' }} />
        )}

        {photo && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(7,62,62,0.78) 0%, rgba(7,62,62,0.28) 38%, rgba(7,62,62,0) 64%)',
            }}
          />
        )}

        {value !== undefined && (
          <div className="absolute right-3 top-3">
            <TierChip cpp={value} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2.5 p-4">
          <span className={`fi fi-${dest.countryCode} mb-1 h-[15px] w-[20px] flex-shrink-0 rounded-[2px]`} aria-hidden />
          <div className="min-w-0">
            <h3 className="truncate font-display text-[24px] font-semibold leading-tight tracking-[-0.01em] text-white">
              {dest.city}
            </h3>
            <p className="truncate text-[12px] font-semibold uppercase tracking-[var(--track-label)] text-white/85">
              {dest.country} · {dest.region}
            </p>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[14px] leading-snug text-text2">{sentenceCase(dest.vibe)}</p>
        <div className="mt-4 flex items-center gap-x-4 border-t border-hair pt-4 text-[13px] text-text3">
          <span>
            <b className="font-semibold text-text2 tabular-nums">{compactMiles(dest.typicalAwardMiles)}</b> mi
            {dest.cabin ? ` · ${dest.cabin}` : ''}
          </span>
          <span aria-hidden>·</span>
          <span>
            <b className="font-semibold text-text2 tabular-nums">${Math.round(dest.typicalCashUSD).toLocaleString('en-US')}</b> cash
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="text-[14px] font-semibold text-text transition-colors group-hover:text-brand">
            Read the guide
          </span>
          <span aria-hidden className="flex-shrink-0 text-[15px] font-semibold text-text3 transition-colors group-hover:text-brand">
            →
          </span>
        </div>
      </div>
      </Card>
    </Link>
  )
}
