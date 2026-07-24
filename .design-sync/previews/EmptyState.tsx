import { EmptyState } from 'hop'

export function WithRoute() {
  return <EmptyState route="SFO → NRT" fromCode="SFO" toCode="NRT" />
}

export function NoRoute() {
  return <EmptyState />
}
