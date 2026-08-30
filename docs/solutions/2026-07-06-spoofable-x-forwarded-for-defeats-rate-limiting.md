---
title: "A rate limiter keyed on x-forwarded-for is only as strong as a client's willingness to lie"
date: 2026-07-06
tags: [rate-limit, security, spoofing, headers, vercel, mcp]
files: [lib/rate-limit.ts, app/api/[transport]/route.ts]
status: solved
---

**What happened:**
`lib/rate-limit.ts#clientIp()` keyed the per-caller token bucket off the first entry in the
`x-forwarded-for` (XFF) header. XFF is a chain of comma-separated IPs that each proxy hop is
supposed to *append* to, but nothing stops a client from sending the header directly to the
origin with whatever contents it likes before any real proxy touches it. An attacker could send a
fresh, made-up `x-forwarded-for` value on every request and get a brand-new empty bucket each
time — the rate limiter would faithfully enforce a limit that no longer applied to anyone, because
every request looked like it came from a different caller.

**Why it matters:**
A rate limiter's entire job is to make repeated abuse from the same caller expensive. If the
"who is this caller" signal is something the caller fully controls, the limiter isn't limiting
anything — it's just adding latency to legitimate traffic while an attacker sails through. This
specific limiter is what stands between the newsletter signup route and unlimited Resend
confirmation-email spam sent to arbitrary third-party addresses, so a bypass here isn't
theoretical — it's a direct abuse vector on a feature about to go live in production
(`HOP_ENABLE_NEWSLETTER`).

**The rule going forward:**
Never trust a header a client can set directly unless a platform is documented to overwrite it at
the edge. Vercel computes `x-vercel-forwarded-for` itself (and `x-real-ip`) from the actual TCP
connection, so those two are safe to trust even when another proxy (hop also runs Cloudflare
workers in front) sits between the client and Vercel. `clientIp()` now checks
`x-vercel-forwarded-for` first, then `x-real-ip`, and only parses the client-suppliable
`x-forwarded-for` as a last resort — a path that only executes off-Vercel (local dev, tests, CI),
never in production. The MCP transport route (`app/api/[transport]/route.ts#clientIpFromExtra`)
mirrors the same header order for the same reason. When adding any new per-caller limiter or
audit log keyed on "client IP," use this same preference order rather than reaching for
`x-forwarded-for` directly.

**Evidence:** pull request #261.
