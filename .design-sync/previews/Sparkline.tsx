import { Sparkline } from 'hop'

export function Uptrend() {
  return <Sparkline data={[12, 18, 15, 22, 27, 31, 40]} label="Active users" />
}

export function Flat() {
  return <Sparkline data={[0, 0, 0, 0, 0]} label="New signups" />
}
