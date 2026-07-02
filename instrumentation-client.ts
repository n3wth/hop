import { initBotId } from 'botid/client/core'

// Client-side BotID setup.
// Instructs Vercel's edge-network protection layer to inject the invisible
// BotID CAPTCHA challenge before letting requests proceed to these high-value
// API endpoints.
initBotId({
  protect: [
    {
      path: '/api/search',
      method: 'GET',
    },
    {
      path: '/api/billing/checkout',
      method: 'POST',
    },
    {
      path: '/api/concierge',
      method: 'POST',
    },
  ],
})
