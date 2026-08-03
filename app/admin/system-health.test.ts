import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SystemHealthContent } from '@/components/admin/AdminDashboard'
import { CRON_JOBS } from '@/lib/health-checks'

const degradation = {
  last24h: { cash: 2 },
  priorWeekDailyMean: { cash: 0.5 },
}

function renderSystemHealth(
  heartbeats: Parameters<typeof SystemHealthContent>[0]['heartbeats'],
  monitoringEnabled = true,
) {
  return renderToStaticMarkup(
    createElement(SystemHealthContent, {
      heartbeats,
      degradation,
      monitoringEnabled,
    }),
  )
}

describe('AdminDashboard system health', () => {
  it('renders one unavailable cron-health state without false never-run rows', () => {
    const html = renderSystemHealth(null)

    expect(html).toContain('Cron health is unavailable.')
    expect(html).not.toContain('never run')
    expect(html).toContain('cash')
  })

  it('renders successful empty heartbeat data as never-run rows', () => {
    const html = renderSystemHealth([])

    expect(html.match(/never run/g)).toHaveLength(CRON_JOBS.length)
    expect(html).not.toContain('Cron health is unavailable.')
  })

  it('preserves the monitoring-off explanation while showing degradation data', () => {
    const html = renderSystemHealth(null, false)

    expect(html).toContain('Monitoring is off (HOP_ENABLE_SELF_IMPROVE).')
    expect(html).not.toContain('never run')
    expect(html).toContain('cash')
  })
})
