import { CountUp } from 'hop'

export function Plain() {
  return <CountUp value={37500} className="font-display text-[28px] font-semibold text-text" />
}

export function Usd() {
  return <CountUp value={243} format="usd" className="font-display text-[28px] font-semibold text-text" />
}

export function Cpp() {
  return <CountUp value={5.4} format="cpp" decimals={1} className="font-display text-[28px] font-semibold text-brand" />
}
