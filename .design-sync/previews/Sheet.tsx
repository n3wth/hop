import { Sheet } from 'hop'

export function Open() {
  return (
    <Sheet open onClose={() => {}} title="Have hop book it">
      <p style={{ fontSize: 14, color: 'var(--color-text2)', lineHeight: 1.5 }}>
        Tell us your dates and hop will book this fare the moment your points cover it.
      </p>
    </Sheet>
  )
}
