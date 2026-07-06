import { initBotId } from 'botid/client/core'

// Client-side BotID setup.
// Instructs Vercel's edge-network protection layer to inject the invisible
// BotID CAPTCHA challenge before letting requests proceed to these high-value
// API endpoints.
//
// /api/billing/checkout and /api/billing/portal are deliberately NOT listed
// here: both are invoked via a plain <form method="POST">, and this SDK only
// patches window.fetch/XMLHttpRequest to attach the challenge header — it
// never intercepts a native form submit, so listing them would just make
// checkBotId() log a permanent false "misconfiguration" on the server for
// every legitimate request. Those two routes rely on auth + rate limiting
// instead (see their route handlers).
initBotId({
  protect: [
    {
      path: '/api/search',
      method: 'GET',
    },
    {
      path: '/api/concierge',
      method: 'POST',
    },
  ],
})
