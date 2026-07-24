import { Tool, ToolHeader, ToolContent } from 'hop'

export function Collapsed() {
  return (
    <Tool>
      <ToolHeader title="Priced with your points" state="output-available" />
    </Tool>
  )
}

export function Expanded() {
  return (
    <Tool open>
      <ToolHeader title="Priced with your points" state="output-available" />
      <ToolContent>
        <p>United MileagePlus · SFO → NRT · 70,000 miles + $43 taxes</p>
      </ToolContent>
    </Tool>
  )
}
