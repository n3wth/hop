import { Button } from 'hop'

export function Primary() {
  return <Button>Continue</Button>
}

export function Secondary() {
  return <Button variant="secondary">Cancel</Button>
}

export function FullWidth() {
  return (
    <div style={{ maxWidth: 320 }}>
      <Button fullWidth>Sign in</Button>
    </div>
  )
}

export function Disabled() {
  return <Button disabled>Continue</Button>
}

export function AsLink() {
  return <Button href="/search">Search flights</Button>
}
