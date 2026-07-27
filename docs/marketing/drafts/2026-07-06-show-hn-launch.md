---
title: "Show HN: hop – computes whether to burn miles or pay cash for a flight"
channel: hn
status: ready-to-paste
---

**Needs**: an HN account with the founder logged in to post to Show HN (news.ycombinator.com/submit,
category "Show HN"). Best posted Tue–Thu, early US morning. No further account setup needed beyond
being logged in.

**Why this post**: hop's engine (deterministic cpp math, MCP server) is the differentiated,
technical part of the product — exactly HN's audience. No invented metrics below; only what's
actually shipped (auth, search engine, MCP server) is claimed.

---

**Title**: Show HN: hop – computes whether to burn miles or pay cash for a flight

**Body**:

I got tired of doing point-value math in a spreadsheet every time I wanted to book a flight, so
I built hop (https://hop.flights).

You give it a route and your real loyalty balances (or just try it with no account — there's a
live no-signup search), and it computes cents-per-point for every award option against the cash
price, then tells you: use points, transfer to a partner, or just pay cash. The verdict is always
a number, never a guess — every figure comes from deterministic code (`cpp = (cash − taxes) × 100
/ miles`), never an LLM. Upstream sources are Duffel (cash fares), Seats.aero (live award space),
and AwardWallet (balances); if any of those go down, that section degrades instead of the whole
page breaking.

It's also exposed as an MCP server, so if you use Claude or another MCP-compatible agent, it can
call hop's tools (`price_trip`, `verdict`, `sweet_spots`, `transfer_paths`) directly with your own
token — genuinely useful for "should I use points for this" as an agent tool call, not just a
webpage.

Built solo, still early. Feedback on the cpp methodology or the MCP tool design especially
welcome — that's the part I'd most like people to poke holes in.
