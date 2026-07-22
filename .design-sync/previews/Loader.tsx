import { Loader } from 'hop'

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--color-brand)' }}>
      <Loader size={12} />
      <Loader size={16} />
      <Loader size={24} />
    </div>
  )
}
