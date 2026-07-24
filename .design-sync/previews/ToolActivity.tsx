import { ToolActivity } from 'hop'

export function Running() {
  return <ToolActivity step={{ tool: 'price_trip', state: 'input-streaming' }} hasBalances />
}

export function Done() {
  return <ToolActivity step={{ tool: 'price_trip', state: 'output-available' }} hasBalances />
}

export function WithDetail() {
  return (
    <ToolActivity
      step={{ tool: 'web_search', state: 'output-available', detail: 'searching United award charts' }}
    >
      <p>Found 3 relevant results.</p>
    </ToolActivity>
  )
}
