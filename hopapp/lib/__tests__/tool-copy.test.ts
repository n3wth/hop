import { describe, it, expect } from 'vitest'
import { toolTitle, shortDetail } from '@/components/ai-elements/tool'

// The tool-activity labels narrate the agent's mid-thought tool use. For a
// signed-out visitor with no balances, price_trip must NOT imply "your points" —
// it's a value demonstration of the route, not pricing points anyone owns.
describe('toolTitle() — ownership-aware labels', () => {
  it('uses value-neutral price_trip copy when there are no balances', () => {
    const done = toolTitle({ tool: 'price_trip', state: 'output-available' }, false)
    expect(done).toBe('Priced this route')
    expect(done.toLowerCase()).not.toContain('your points')
    const running = toolTitle({ tool: 'price_trip', state: 'input-available' }, false)
    expect(running).toBe('Pricing this route…')
  })

  it('uses the ownership voice for price_trip when balances are in play', () => {
    expect(toolTitle({ tool: 'price_trip', state: 'output-available' }, true)).toBe(
      'Priced with your points',
    )
  })

  it('leaves non-economic tools unchanged regardless of balances', () => {
    expect(toolTitle({ tool: 'get_weather', state: 'output-available' }, false)).toBe(
      'Checked the weather',
    )
    expect(toolTitle({ tool: 'web_search', state: 'input-available' }, true)).toBe(
      'Searching the web…',
    )
  })
})

describe('shortDetail() — neutral suffix is stripped too', () => {
  it('collapses "Pricing HNL against cash" to just the place', () => {
    expect(shortDetail('Pricing HNL against cash')).toBe('HNL')
  })
  it('still collapses the ownership suffix', () => {
    expect(shortDetail('Pricing NRT against your points')).toBe('NRT')
  })
})
