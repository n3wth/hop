import { CardAffiliateCTA } from 'hop'

// Sponsored placement — designed for hop's dark teal verdict hero, never a
// light surface (its copy uses white/hero-label tokens).
export function OnVerdictHero() {
  return (
    <div style={{ background: 'var(--color-brand-ink)', padding: '24px 20px 4px' }}>
      <CardAffiliateCTA program="united" unit="miles" />
    </div>
  )
}
