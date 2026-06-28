import Icon, { type IconName } from './Icon'

interface RailItem {
  name: IconName
  label: string
  active?: boolean
}

const TOP_ITEMS: RailItem[] = [
  { name: 'flight', label: 'Flights', active: true },
  { name: 'loyalty', label: 'Points' },
  { name: 'receipt_long', label: 'Trips' },
  { name: 'schedule', label: 'History' },
]

const BOTTOM_ITEMS: RailItem[] = [{ name: 'settings', label: 'Settings' }]

function RailButton({ item }: { item: RailItem }) {
  return (
    <button
      type="button"
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
      className={[
        'flex h-[46px] w-[46px] items-center justify-center rounded transition-colors',
        item.active
          ? 'bg-brand-light text-brand'
          : 'text-text3 hover:bg-border-soft hover:text-text2',
      ].join(' ')}
    >
      <Icon name={item.name} size={24} />
    </button>
  )
}

// Icon-only vertical nav, width == square.
export default function Rail() {
  return (
    <nav className="flex h-full flex-col items-center gap-1.5 py-3.5">
      {TOP_ITEMS.map((item) => (
        <RailButton key={item.name} item={item} />
      ))}
      <div className="flex-1" />
      {BOTTOM_ITEMS.map((item) => (
        <RailButton key={item.name} item={item} />
      ))}
    </nav>
  )
}
