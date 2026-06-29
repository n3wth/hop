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
    source: 'Award space',
    title: 'Finds bookable seats',
    body: 'It checks where seats are actually bookable with miles on your exact dates and route.',
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
    title: 'Names the smarter book',
    body: 'hop computes the value of each redemption and names the one verdict: points or cash.',
  },
]

export default function HowItWorks() {
  return (
    <section>
      <div className="flex flex-col gap-2 sm:max-w-[52ch]">
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
          How hop works
        </span>
        <h2 className="font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[34px]">
          One search reads your points, the market, and the math.
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
                <Icon name={s.icon} size={22} />
              </span>
              <span className="font-display text-[15px] font-semibold tabular-nums text-text3">
                0{i + 1}
              </span>
            </div>
            <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
              {s.source}
            </div>
            <h3 className="mt-1.5 font-display text-[18px] font-semibold leading-[1.15] tracking-[-0.01em] text-text">
              {s.title}
            </h3>
            <p className="mt-2 text-[13.5px] leading-[1.55] text-text2">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
