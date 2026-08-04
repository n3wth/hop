import { EditorialHeader } from 'hop'

export function Default() {
  return (
    <EditorialHeader
      eyebrow="Sweet spots"
      title="The best award redemptions right now"
      intro="Real cents-per-point value across every program hop tracks, ranked so you always know where your points go furthest."
    />
  )
}

export function WithStatLine() {
  return (
    <EditorialHeader eyebrow="Destinations" title="Where your points can take you" intro="Ranked by value, not distance.">
      <p style={{ marginTop: 16, fontSize: 13, color: 'var(--color-text2)' }}>
        128 destinations · updated daily
      </p>
    </EditorialHeader>
  )
}
