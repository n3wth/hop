import { Tool, ToolHeader, ToolContent } from 'hop'

export function Expanded() {
  return (
    <Tool open>
      <ToolHeader title="Searched the web" icon="search" state="output-available" />
      <ToolContent>
        <p>Found 3 award charts mentioning SFO–NRT business class redemptions.</p>
      </ToolContent>
    </Tool>
  )
}
