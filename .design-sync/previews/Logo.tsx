import { Logo } from 'hop'

export function Default() {
  return <Logo />
}

export function Large() {
  return <Logo size={84} />
}

export function OnDarkSurface() {
  return (
    <div style={{ padding: 20, background: 'var(--color-brand-ink)' }}>
      <Logo size={64} carve="var(--color-brand-ink)" className="text-white" />
    </div>
  )
}
