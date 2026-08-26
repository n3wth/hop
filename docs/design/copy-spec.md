# hop — UI copy spec (de-slopped, useful-first)

Use this as the canonical voice and UI-string guide for product surfaces.

Scope:
- Applies to product UI copy in app surfaces and core component labels.
- Does not override legal copy requirements in policy/support pages.
- If this file conflicts with shipping behavior, update this file in the same change.

Voice: terse, confident, plain. No marketing language, no "value on the table" / "war chest" /
"set fire to" clichés, no emoji, no over-cute bunny chatter. State the answer and the number.
One light personality touch max per region. Every string must help the user decide or act.

## Verdict hero

The canonical worked example is the SFO→LAX ROUND TRIP mock (lib/mock.ts through the real
engine): cash $254 RT, Alaska saver 4,500 mi + $11.20 taxes per direction → 9,000 miles +
$22 taxes, cpp = (254 − 22.40) × 100 / 9000 = 2.6¢/pt, save $254 − $22 ≈ $232. Rules that
keep it trustworthy: the math must CLOSE on screen (cash − savings = the taxes shown — never
hide the taxes), the unit is `¢/pt` (never `¢/mile`, never a bare "cpp"), and the route label
must match the economics — believable figures for the labeled route and cabin, always.

- Kicker: `BEST VALUE` (not "HOP'S CALL · BEST VALUE")
- Headline: `Use your Alaska miles.` / `Save $232 vs cash.`  (two lines, the $ is the hook)
- Subline (plain, factual): `9,000 miles + $22 taxes at 2.6¢ per point — the best redemption
  across your 6 programs. Cash is $254 round trip. You have the miles.`
- Primary CTA: `Book with Alaska miles`

## Verdict hero — chart (`availability: 'chart'`)

Same SFO→LAX math. The distinctive fact is **space not confirmed**, not "hop isn't
holding a seat." Saver-floor miles stay the table number; uncertainty lives in the
caveat. Do not use `estimated` / `about` / `up to` on the miles figure.

- Kicker: `CHART · IF SAVER IS OPEN`
- Headline: `Alaska chart: 2.6¢/pt.`
- Hook: `Save $232 vs cash if saver is open.`
- Extra: `Published saver rate. Space not confirmed.`
- Primary CTA: `Check Alaska for space`
- Empty awards: `No published saver chart for this route.`
- Alert subject: never `Award space opened` / `Book now` on a chart row. Use
  `Cash vs chart: …` or do not send.

`You have the miles` (balance fact) may stay. `Use your Alaska miles` (spend
instruction) may not, on chart.
- Secondary: `See the math` (links to CPP breakdown — NOT "Why this wins →")
- Stat row: `You pay 9,000 miles + $22` · `Value 2.6¢/pt` · `Cash price $254` · `You save $232`
- Confidence chip: drop "hop is confident on this one." Replace with nothing, or a quiet
  `Direct · 1h 32m` fact. Confidence should be shown by the design, not claimed in words.

## Pick card (boarding-pass)
- Label: `Our pick`
- Airline: `Alaska Atmos` · tag `Direct` · `Operated by Alaska / American`
- Route: `SFO 7:05a → LAX 8:37a · 1h 32m`

## Alternatives section
- Heading: `Other ways to fly` (not "The supporting cast")
- Subhead: `Ranked by value.` (not "ranked by what they actually return")
- Each card: rank label (`2nd`/`3rd`/`4th`/`Cash`), airline, miles/price, value ¢/pt with a
  value bar, and ONE plain assessment line (no bunny first-person theatrics):
  - Southwest: `Solid — 4.1¢/pt, but 1,500 more miles than Alaska for the same flight.`
  - United via Aeroplan: `Needs an Amex or Chase transfer first. 2.5¢/pt — fine, not great.`
  - United MileagePlus: `Skip it. Dynamic pricing makes 1.8¢/pt a poor use of miles.`
  - United cash: `$254 round-trip. Earns ~$7.62. Only if you'd rather keep the miles.`
- Action buttons: `Book with miles` / `Transfer & book` / `Book cash` / `Pay cash instead`

## Points panel
- Heading: `Your points` · source `AwardWallet`
- Total: `618,314 across 6 programs`
- Active program note (Alaska row): `Using 9,000 here` (not "spending here" / "USING NOW")
- Drop the gold "one quiet tip" Amex→Alaska card unless it's genuinely actionable; if kept,
  make it a fact: `Amex transfers to Alaska 1:1 if you run low.`

## Your programs (/account) — balance-optional add + quick-start
- Balance field placeholder/label: `Balance (optional)` (not "Balance") — an empty balance is a
  valid submission, not an error.
- A saved program with balance `0` (unset, not a real zero): `Balance not set — add it` (a text
  link into edit mode) — never show a bare `0`, which reads as "you hold nothing here."
- Quick-start button (empty state only): `Add the 5 majors`
- Quick-start subtext: `Amex, Chase, Citi, Capital One, and Bilt — hop shows what your points are
  worth once you fill in real balances.` (plain, no exclamation points, no "just add your cards!"
  flattery)

## Public surfaces — Stage A awards (④b)

Do not claim live award space on marketing, metadata, skeleton, login, /ask,
or concierge tool prompts. Awards are published saver charts. Use
`published saver chart` / `published saver rate`. Caveat: `Space not confirmed.`
cpp on a chart row is live (Duffel cash vs those published miles). Do not
call that "live award space."
Human-fulfilled concierge ("find the award space and book it") may keep
"award space" — a person is looking.

## Footer / utility (keep it a real tool)
- `hop compares cash, miles, and transfer partners in one search.` (one plain line, no "tells you
  which one to actually use" swagger)
- Real utility links: `How we value points` · `Refresh balances` · `Price alert`

## Bunny personality budget
- The bunny is the LOGO and ONE optional warm moment (e.g. an empty/loading state), not a
  narrator on every row. No speech bubbles in the results. Personality comes from type, color,
  composition, and the logo — not from making the rabbit talk.
