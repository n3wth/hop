import { Icon } from 'hop'

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Icon name="airplane" size={12} />
      <Icon name="airplane" size={16} />
      <Icon name="airplane" size={20} />
      <Icon name="airplane" size={24} />
    </div>
  )
}

export function Vocabulary() {
  const names = ['search', 'flight', 'wallet', 'trending_up', 'check_circle', 'warning', 'loyalty', 'globe'] as const
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {names.map((n) => (
        <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text2)' }}>
          <Icon name={n} size={24} />
          {n}
        </div>
      ))}
    </div>
  )
}

export function Weights() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Icon name="star" size={24} weight="regular" />
      <Icon name="star" size={24} weight="fill" />
      <Icon name="star" size={24} weight="bold" />
    </div>
  )
}
