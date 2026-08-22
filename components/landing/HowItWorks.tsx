import Icon, { type IconName } from '@/components/Icon'

interface Step {
  icon: IconName
  source: string
  title: string
  body: string
}

// The honest mechanism — four plain steps, so trust is earned by specificity,
// not adjectives. Flat cards on cream; the connecting number rail reads as a
// single sequence.
const STEPS: Step[] = [
  {
    icon: 'loyalty',
    source: 'Your balances',
    title: 'Reads your real points',
    body: 'Add your programs once and hop knows exactly how many points and miles you have to spend.',
  },
  {
    icon: 'flight',
    source: 'Published saver chart',
    title: 'Prices the miles',
    body: 'It reads the published saver chart for the route and computes cents-per-point. It does not confirm saver space is open.',
  },
  {
    icon: 'receipt_long',
    source: 'Cash fares',
    title: 'Prices the same flight',
    body: 'Live cash prices for those same flights, so the comparison is apples to apples.',
  },
  {
    icon: 'workspace_premium',
    source: 'The verdict',
    title: 'Names points or cash',
    body: 'hop computes the value of each redemption and names the one verdict: points or cash.',
  },
]

export default function HowItWorks() {
  return (
    <section>
      <div className="mx-auto flex max-w-[64ch] flex-col items-center gap-2 text-center">
        <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
          How hop works
        </span>
        <h2 className="max-w-[26ch] text-balance font-display text-[32px] font-bold leading-[1.08] tracking-[-0.025em] text-text sm:text-[44px] lg:text-[52px]">
          How your agent reads the market
        </h2>
      </div>

      <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="flex flex-col rounded-[18px] border border-border bg-paper p-6"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-light text-brand">
                <Icon name={s.icon} size={24} weight="fill" />
              </span>
              <span className="font-display text-[15px] font-semibold tabular-nums text-text3">
                0{i + 1}
              </span>
            </div>
            <div className="mt-5 text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
              {s.source}
            </div>
            <h3 className="mt-1.5 text-balance font-display text-[18px] font-semibold leading-[1.15] tracking-[-0.01em] text-text">
              {s.title}
            </h3>
            <p className="mt-2 text-[13.5px] leading-[1.55] text-text2">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
