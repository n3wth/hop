import { Tool, ToolHeader } from 'hop'

export function Running() {
  return (
    <Tool>
      <ToolHeader title="Pricing with your points…" state="input-streaming" />
    </Tool>
  )
}

export function Done() {
  return (
    <Tool>
      <ToolHeader title="Searched the web" icon="search" state="output-available" />
    </Tool>
  )
}

export function Errored() {
  return (
    <Tool>
      <ToolHeader title="Couldn't reach the pricing engine" state="output-error" />
    </Tool>
  )
}
