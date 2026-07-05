---
title: Travelpayouts attribution must be baked into the /api/go/kiwi destination (marker ≠ trs)
date: 2026-07-04
tags: [travelpayouts, affiliate, attribution, tp-media, outclick, redirect, kiwi, revenue, marker, trs]
files: [lib/booking.ts, app/api/go/kiwi/route.ts, app/layout.tsx, lib/__tests__/booking-outclick.test.ts]
status: solved
---

## Problem

Cash-booking CTAs route through the first-party ledger redirect `/api/go/kiwi?to=<kiwi url>`
(R0.6). The Travelpayouts client tag in `app/layout.tsx` only decorates clicks on links that
point **directly** at partner domains — it cannot see through a same-origin 302. So every cash
outclick landed on kiwi.com with no affiliate id: zero commission, silently.

## Solution

Bake attribution into the redirect **destination**: `cashBookingUrl` now wraps the Kiwi
deep-link in the tp.media attribution redirect before handing it to `cashOutclickPath`:

```
/api/go/kiwi?to=https://tp.media/r?marker=745576&trs=545389&p=4136&campaign_id=111&u=<kiwi url>
```

tp.media 302s to the exact `?u=` URL with `affilid=travelpayoutsdeeplink__…-745576` appended.
`tp.media` was already in the route's redirect allowlist (the seam was anticipated).

## Non-obvious learnings

1. **"Project 545389" is the `trs` (traffic source id), NOT the marker.** The affiliate
   marker for this account is **745576**. The tag's script URL (`NTQ1Mzg5.js?t=545389` —
   base64 of the trs) and all repo comments say "project 545389", which invites conflating
   the two. A tp.media link with `marker=545389` would attribute to nobody.

2. **You don't need dashboard access to mint the link template.** The tag's own backing APIs
   answer from a whitelisted origin, no login:
   - `GET emrldtp.com/entrypoint_config?page_url=<page>&t=<trs>` → project config. Watching
     prod network traffic on hop.flights exposed the follow-up
     `GET emrldtp.com/config?…&marker=745576&trs=545389` — which is where the real marker
     surfaced.
   - `POST emrldtp.com/link-switch/v1/convert?location=<page>&trs=<trs>` with body
     `{"marker":"<marker>","origin_urls":["<partner url>"]}` → `{results: {<url>:
     {partner_url, status}}}` — the exact tp.media link TP itself would mint (this is how
     the tag's "link switcher" works). For Kiwi.com it returned `p=4136&campaign_id=111`.
   - Both 403 from curl; run them from the production page context (devtools console /
     browser MCP) so origin and page_url match the whitelisted domain.

3. **Verify the attribution hop with curl, no browser needed:**
   `curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" "https://tp.media/r?…"` must
   show a 302 to the original kiwi.com URL with an `affilid` ending in the marker.

4. Keep `kiwi.com` in the outclick allowlist even after the swap — stale/shared
   `/api/go/kiwi?to=<raw kiwi>` links keep working. And the route stays 302 (never 308):
   the destination form has now changed once already; a cached permanent redirect would pin
   browsers to the old one.

5. **tp.media/r is an OPEN redirector — allowlisting its host reintroduces an open
   redirect unless you also validate the inner `?u=` target.** Verified 2026-07-04:
   `curl "https://tp.media/r?marker=745576&u=https://example.com/phish"` 302s straight to
   `example.com` (appending only `affilid`). So `isAllowedCashOutclickUrl` must not trust
   the outer host alone: for a `tp.media`/`www.tp.media` host it now requires a `?u=` param
   that is itself a clean-https kiwi.com URL (same host/credential/port checks recursed onto
   the inner URL). Without that, `/api/go/kiwi?to=https://tp.media/r?u=<attacker>` would
   launder an open redirect through hop.flights → tp.media → attacker — exactly the class of
   bug the allowlist exists to prevent, and a phishing gift (the link visibly starts on
   hop.flights). Caught by the security-reviewer subagent on this diff.

## Post-deploy check

In prod devtools: click a cash CTA → `/api/go/kiwi` 302 → `tp.media/r` 302 → kiwi.com with
`affilid=…-745576`. Then confirm clicks appear in the Travelpayouts dashboard report a day
later.
