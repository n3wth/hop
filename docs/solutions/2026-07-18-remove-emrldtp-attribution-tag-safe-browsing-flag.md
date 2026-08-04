---
title: Removed the emrldtp.com Travelpayouts attribution tag after a Google Safe Browsing "Deceptive pages" flag
date: 2026-07-18
tags: [travelpayouts, affiliate, security, safe-browsing, third-party-script, seo]
files: [app/layout.tsx]
status: solved
---

## Problem

Google Search Console flagged the production site with a "Deceptive pages" Safe Browsing
warning (no sample URLs given). The only third-party `<script src>` loaded site-wide in
production was the Travelpayouts auto-attribution tag in `app/layout.tsx`:

```
<Script src="https://emrldtp.com/NTQ1Mzg5.js?t=545389" strategy="lazyOnload" />
```

`emrldtp.com` is not one of Travelpayouts' documented public domains (`tp.media`,
`travelpayouts.com`); a prior investigation
(`docs/solutions/2026-07-04-travelpayouts-attribution-through-first-party-redirect.md`) had
verified it does answer Travelpayouts' own `entrypoint_config`/`config`/`link-switch` endpoints
from the production origin, so it wasn't a spoofed domain at the time. But it's still a live,
remotely-controlled third-party script with no subresource integrity pin, loaded on every page —
exactly the shape Safe Browsing's social-engineering classifier watches for, and third-party ad/
attribution networks compromising a previously-clean script is a well-known vector (the site's
own committed code stays clean; the served JS changes upstream).

## Solution

Removed the `<Script>` tag and its `next/script` import from `app/layout.tsx` entirely. This does
**not** affect commission attribution: `lib/booking.ts#cashBookingUrl` already bakes the
`marker`/`trs` attribution directly into the `/api/go/kiwi → tp.media → kiwi.com` redirect chain
(R0.6, see the 2026-07-04 doc), which is how the cash CTA — the only revenue-bearing link — earns
commission. The removed tag only "decorated" clicks on any *other* links pointing directly at
partner domains, which hop doesn't currently have outside the CTA.

## Non-obvious learnings

1. **A same-origin redirect ledger (`/api/go/kiwi`) plus destination-baked attribution makes a
   client-side attribution tag redundant for the only link that matters.** Don't keep a
   site-wide third-party script alive for a feature (decorating incidental direct partner
   links) with a real security surface, when it isn't load-bearing for revenue.
2. **Any external `<script src>` added site-wide deserves scrutiny disproportionate to how small
   the diff looks.** This one was bundled into an unrelated admin-feature PR (`d1d7728`)
   without its own review — the kind of thing `docs/solutions/2026-07-05-*.md`'s
   multi-agent-hygiene lessons already warn about (grep for a feature/change before trusting it
   rode in on the right PR).
3. If Travelpayouts on-page attribution is wanted again later, prefer their documented
   `tp.media`/`travelpayouts.com` endpoints only, and re-verify the flag clears in Search
   Console (Google's re-review can take days) before considering this fully resolved.
