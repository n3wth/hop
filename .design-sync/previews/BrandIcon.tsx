import { BrandIcon } from 'hop'

export function KnownBrands() {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <BrandIcon slug="united" name="United" />
      <BrandIcon slug="delta" name="Delta" />
      <BrandIcon slug="chase" name="Chase" />
    </div>
  )
}

export function UnknownCarrierMonogram() {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <BrandIcon code="B6" name="JetBlue" />
      <BrandIcon code="WN" name="Southwest" />
    </div>
  )
}

export function DarkSurface() {
  return (
    <div style={{ display: 'flex', gap: 16, padding: 20, background: 'var(--color-brand-ink)' }}>
      <BrandIcon slug="united" name="United" surface="dark" />
      <BrandIcon code="B6" name="JetBlue" surface="dark" />
    </div>
  )
}
