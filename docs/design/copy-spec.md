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
- Kicker: `BEST VALUE` (not "HOP'S CALL · BEST VALUE")
- Headline: `Use your Alaska miles.` / `Save $243 vs cash.`  (two lines, the $ is the hook)
- Subline (plain, factual): `4,500 miles at 5.4¢ each — the best redemption across your 6 programs.
  Cash is $254. You have the miles.`
- Primary CTA: `Book with Alaska miles`
- Secondary: `See the math` (links to CPP breakdown — NOT "Why this wins →")
- Stat row: `You pay 4,500 miles` · `Value 5.4¢/mile` · `Cash price $254` · `You save $243`
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
- Active program note (Alaska row): `Using 4,500 here` (not "spending here" / "USING NOW")
- Drop the gold "one quiet tip" Amex→Alaska card unless it's genuinely actionable; if kept,
  make it a fact: `Amex transfers to Alaska 1:1 if you run low.`

## Footer / utility (keep it a real tool)
- `hop compares cash, miles, and transfer partners in one search.` (one plain line, no "tells you
  which one to actually use" swagger)
- Real utility links: `How we value points` · `Refresh balances` · `Price alert`

## Bunny personality budget
- The bunny is the LOGO and ONE optional warm moment (e.g. an empty/loading state), not a
  narrator on every row. No speech bubbles in the results. Personality comes from type, color,
  composition, and the logo — not from making the rabbit talk.
