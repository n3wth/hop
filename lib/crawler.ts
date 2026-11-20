// User-agent crawler check for server-rendered pages that fan out to paid,
// rate-limited upstreams (/search → Duffel). BotID (checkBotId) only covers
// fetch/XHR calls the client SDK patches, never a plain page navigation, so a
// crawler following /search?from=…&to=… links reaches the engine unchecked.
//
// Deliberately broad: a false positive only shows a real visitor the search
// form instead of a verdict; a false negative spends a Duffel call. A missing
// user agent counts as a crawler — every real browser sends one.
const CRAWLER_UA =
  /bot\b|crawl|spider|slurp|facebookexternalhit|facebookcatalog|externalagent|whatsapp|bingpreview|link preview|skypeuripreview|google-|ia_archiver|headless|python-|curl\/|wget|go-http-client|scrapy|node-fetch|axios/i

export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return true
  return CRAWLER_UA.test(userAgent)
}
