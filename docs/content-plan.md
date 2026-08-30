# hop content + destination data plan

A practical content strategy for hop's expansion from points-vs-cash optimizer into a travel companion (inspiration, deals feed, AI concierge, destination guides). Researched June 2026 against current award-travel sources. Numbers are flagged where dynamic pricing or recent devaluations make them approximate — treat the sweet-spots table as seed reference data, not guarantees, and verify live before any user-facing "book this" claim.

Use this document as strategy and seed-data guidance, not as a real-time pricing source.

Quick navigation:
- Section 1: content-type prioritization
- Section 2: sweet-spots seed table
- Section 3: destination card/guide schema direction
- Section 4: SEO and discovery strategy
- Section 5: concierge seed prompts

---

## 1. Content types, prioritized by impact vs effort

hop's edge over generic points blogs (TPG, Upgraded Points): it already knows the user's *actual balances* (AwardWallet) and can compute *live cents-per-point* (Seats.aero + Duffel). So the winning content is the kind that's **personalized and computed**, not just evergreen prose. Lead with content that exploits that data moat; use evergreen SEO content as the top-of-funnel that pulls strangers in.

Priority key: **P0** = build first (high impact, leverages existing data), **P1** = strong SEO/trust play, **P2** = nice-to-have / later.

| Content type | What it is | Why it works for this audience | Effort | Cadence | Priority |
|---|---|---|---|---|---|
| **"Your points → these destinations"** | Personalized list: given the user's real balances, where can they actually fly (and at what cpp). | This is hop's killer feature. No blog can do it — it requires live balances. Drives the "wow" and retention. | Med (uses existing balance + cpp + destinations data) | Live / on every visit | **P0** |
| **Award sweet-spot guides** | Evergreen guide per sweet spot (e.g. "ANA First to Japan with Virgin points"). Route, program, miles, why it's good, how to book. | Highest-intent SEO. People search exact routes. Establishes trust/authority. Feeds the deals dataset. | Med-High (research + maintenance) | ~15 to start, refresh quarterly | **P0** |
| **Deals / sweet-spot feed** | Card feed of standout redemptions, ranked by cpp, hookable to the user's origin + dates. | Habit-forming. The "deals" surface is the reason to open the app weekly. Cards already exist (`DealCard.tsx`). | Med (curate dataset + rank by live cpp) | Daily-ish refresh | **P0** |
| **Destination cards/guides** | Per-destination: vibe, when to go, points cost, the sweet spot to get there. | Wanderlust top-of-funnel. Pairs inspiration with hop's actionable "here's how." Schema already exists (`destinations.ts`). | Med | ~30-50 cards, evergreen + seasonal refresh | **P0** |
| **"How to use [program] points" guides** | Per-program: what it's good for, transfer partners, sweet spots, gotchas (fuel surcharges, devaluations). | Beginners search "best use of Amex points." Captures the confused-but-motivated. | Med | 1 per major currency (~8) | **P1** |
| **Points-valuation explainers** | "What's a point worth?" + hop's cpp methodology. The 1.5/3.0/5.0 cpp benchmark. | Builds trust in hop's core number. Differentiates hop's *computed* cpp from blogs' static valuations. | Low-Med | 1-2 evergreen, update annually | **P1** |
| **Transfer-partner guides** | "Amex → which airline?" with current ratios + live transfer bonuses. | High-intent + time-sensitive (bonuses "print monthly"). Bonus alerts drive re-engagement. | Med (bonuses need monthly upkeep) | Evergreen base + monthly bonus updates | **P1** |
| **Route-specific deal alerts** | "Award space just opened SFO→NRT business, 8.2cpp." Push/email. | hop can detect this from Seats.aero live. Genuinely useful, drives notifications opt-in. | High (needs alerting infra) | Triggered | **P1** |
| **Beginner education** | "Points 101": transferable currencies, why not to redeem for cash-back, alliance basics. | Expands TAM beyond hardcore churners. Evergreen SEO. | Low-Med | ~5-8 evergreen | **P1** |
| **Seasonal / event travel guides** | "Cherry blossom season with points," "ski Japan on miles," shoulder-season value. | Timely SEO spikes. Ties vibe (destination) to action (sweet spot). | Med | 4-6/year | **P2** |
| **Comparison content (program vs program)** | "Aeroplan vs United for Star Alliance business." | Mid-funnel decision content, ranks well, links internally. | Med | ~6-10 | **P2** |
| **Error-fare / mistake-fare alerts** | Pricing-glitch cash fares. | Big traffic spikes, viral. BUT off-thesis (cash, not points), high volatility, reputational risk if fare dies. | Med-High | Opportunistic | **P2 / skip** |

**Recommendation:** ship the four P0 surfaces (personalized "your points →", sweet-spot guides, deals feed, destination cards) as the launch core — they're the ones that compound hop's data advantage and are mostly already scaffolded. Layer P1 SEO/education content over the following two quarters to capture cold search traffic. Treat error fares as out of scope for now (off-thesis, high-maintenance).

---

## 2. Award sweet-spots reference table

Seed data for the deals feed and destination dataset. **Accuracy caveats:** many programs moved to dynamic pricing in 2025-2026 (Aeroplan partner awards, GOL Smiles, Virgin on some routes), so "miles cost" is the *typical good-case* figure, not a fixed chart price where noted. Several recent changes are baked in below: **Aeroplan's June 2026 devaluation** raised the NA↔Asia business sweet spot from 87.5k to ~102.5k; **Avios had a Dec 2025 devaluation**; **Alaska rebranded Mileage Plan → Atmos Rewards**; **Hawaiian joined oneworld (Apr 22, 2026)** so its metal is now bookable with AA/BA/JAL/Cathay/Qatar Avios. Verify live before surfacing as bookable.

| # | Route / region | Program (book with) | Cabin | ~Miles (one-way) | Why it's a deal | Confidence |
|---|---|---|---|---|---|---|
| 1 | US ↔ Japan | **Virgin Atlantic** (ANA metal) | First (The Suite) | 55k-60k ow | Cash often >$10k → ~8cpp+. No fuel surcharges on ANA partner awards. Limited award space; book early. | High |
| 2 | US ↔ Japan | **Alaska / Atmos** (JAL metal) | Business | 60k ow | JAL J for 60k, ~$50 taxes, no fuel surcharges. Note: JAL partner space increasingly hard to find via Alaska. | High |
| 3 | US ↔ Japan | **Alaska / Atmos** (JAL metal) | First | 70k ow | 777 First for 70k; one of the cheapest int'l First redemptions. Scarce space. | High |
| 4 | US ↔ Asia | **Alaska / Atmos** (Cathay metal) | Business | 50k ow | Cathay J to Asia ~$4.5k-7k cash. Free stopover on one-way partner awards (e.g. HKG en route). | High |
| 5 | US ↔ Asia | **Alaska / Atmos** (Cathay metal) | First | 70k ow | Cathay F, exceptional cpp; stopover allowed. | High |
| 6 | US ↔ Europe | **Aeroplan** (Star Alliance) | Business | 60k ow (fixed-chart partners) | ~$3.5k-5.5k cash. Stopover +5k miles flat. Watch: 2025 dynamic pricing crept onto some partners; ANA/LH/Singapore/etc. still on fixed chart. | High |
| 7 | US ↔ Europe | **Virgin Atlantic** (Delta One metal) | Business | 50k ow | Often far cheaper than Delta SkyMiles for the same seat; no fuel surcharge on Delta partner awards. | High |
| 8 | US ↔ Europe | **Turkish Miles&Smiles** (Star Alliance) | Business | 45k ow | ANA/LH/Swiss/United J for 45k vs $3.5k-5k cash → 9cpp+. Caveat: notoriously hard-to-use website/transfers. | Med (value high, usability low) |
| 9 | US ↔ Europe | **Avianca LifeMiles** (Lufthansa metal) | First | 100k-120k ow | LH First, zero fuel surcharges. Frequent Amex transfer bonuses (15% through ~Jul 15 2026) cut the effective cost. | High |
| 10 | Short-haul Europe (off-peak) | **Avios** (BA/Iberia/Aer Lingus) | Economy | 4k-7.5k ow | Zone-1 off-peak (Dublin, Amsterdam, Paris) from ~4k Avios, low taxes. Distance-based chart. Post-Dec-2025 devaluation but still strong short-haul. | High |
| 11 | US ↔ Hawaii | **Alaska / Atmos** or oneworld Avios (Hawaiian/AA metal) | Economy | 10k-22k ow | From ~10k mi ex-California on Hawaiian via Alaska; Hawaiian now oneworld so Avios works too. Low taxes (~$6). | High |
| 12 | US ↔ South America (Colombia) | **Avianca LifeMiles** | Economy | from 16k ow | Cheap into Bogotá/Medellín; no fuel surcharges; transfer-bonus friendly. | High |
| 13 | US ↔ Australia | **Alaska / Atmos** (Qantas metal) | Business | 55k ow | Qantas J across the Pacific for 55k — strong vs cash and vs other programs' Pacific pricing. | High |
| 14 | Middle East ↔ region / to US | **Avios** (Qatar Qsuite) | Business | (Avios, distance-based) | Qatar Qsuite widely rated best business class; bookable with Avios + via Alaska (Qatar) at 70k ow on Alaska chart. | High |
| 15 | US ↔ Asia | **Aeroplan** (Star Alliance) | Business | ~102.5k ow (post-Jun-2026) | Was 87.5k; raised in June 2026 devaluation. Still a long-distance band with good ratio + stopover option. | High (post-deval) |
| 16 | Intra-Asia / TYO↔SYD | **Avianca LifeMiles** (ANA metal) | Business | 40k ow | HND-SYD in ANA J for 40k, no surcharges. | Med |

General cpp guidance to encode in hop's tiering (matches industry consensus and existing `lib/cpp.ts` philosophy): **≥1.5cpp** = floor for transferable points, **≥3.0cpp** = strong, **≥5.0cpp** = exceptional.

Sources: [Upgraded Points — sweet spots 2026](https://upgradedpoints.com/news/6-airline-award-sweet-spots-in-2026/), [AwardWallet sweet-spots roundup](https://awardwallet.com/travel/award-program-sweet-spots/), [Virgin Atlantic sweet spots](https://awardwallet.com/airlines/virgin-atlantic-flying-club/sweet-spots/), [Alaska/Atmos sweet spots](https://awardwallet.com/airlines/alaska-atmos-rewards/best-use-of-alaska-miles/), [Avios sweet spots](https://awardtravelfinder.com/avios-sweet-spots), [LifeMiles sweet spots](https://awardwallet.com/airlines/avianca-lifemiles/avianca-lifemiles-sweet-spots/), [Aeroplan 2026 chart changes](https://www.maxmilespoints.com/blog/aeroplan-award-chart-changes-2026), [Frequent Miler — best ways to Asia 2026](https://frequentmiler.com/best-ways-to-get-to-asia-using-points-and-miles/), [TPG — travel to Japan with points](https://thepointsguy.com/loyalty-programs/travel-to-japan-with-points-and-miles/).

**This table also grows via an automated candidate pipeline now**
(`lib/sweet-spot-candidates.ts`,
`docs/plans/2026-07-05-content-candidate-pipeline.md`): a daily cron mines
`assembleSearch` itself over a curated hub/destination/date grid for notable
Business-cabin redemptions and drops up to 3/run into the
`hop_sweet_spot_drafts` review queue as `pending_review` — the owner still
approves every row by hand, same as the manually-typed flow above. Deferred:
a second signal via the valuation Worker (extending `observations` with a
`route`/`cabin` column, once valuation-sync is confirmed healthy) — see the
plan's §2 for why the direct-mining approach shipped first.

---

## 3. Destination content — what makes a great card/guide

A great hop destination card marries **inspiration** (the vibe, the why-go) with **action** (the points play to get there). hop's existing `Destination` schema already captures most of this — the template below extends it to a full guide.

**What separates a great card from a generic one:**
- A *vibe line* that earns the wanderlust, not a Wikipedia summary ("neon nights & quiet temples" beats "capital of Japan").
- An honest *best time to go* that flags shoulder-season value (where points + crowds + weather align).
- A *concrete sweet spot*, not "use your points" — name the program, metal, and rough cost.
- A *live cpp hook* — hop can show "your points get you there at ~X cpp right now," which no static guide can.

**Card template (compact, feed/grid):**
```
[image]  Tokyo 🗼  ·  Asia
"neon nights & quiet temples"
✈ ~37.5K mi ow  ·  ~$720 cash  ·  ANA via Amex MR
[cpp chip: STRONG 3.4¢]   tags: food · culture · city
```

**Full guide template (destination page):**
```
City, Country — region
Hero image + vibe line (one evocative sentence)

THE VIBE        2-3 sentences: what it feels like, who it's for.
WHEN TO GO      Best months + why; shoulder-season value window; what to avoid.
GETTING THERE   Typical award (miles ow) + cash comp + the standout sweet spot
                (program, metal, ~miles, "no fuel surcharges" / "free stopover" notes).
POINTS PLAY     Which of YOUR currencies transfer here; live cpp if signed in.
STAY            (optional) 1-2 high-value hotel notes (e.g. Hyatt Cat 1-4 sweet spot).
GOOD TO KNOW    Visa/season/1 practical gotcha.
[CTA] Search SFO → NRT for your dates
```

Map to existing fields: `vibe`, `region`, `typicalAwardMiles`, `typicalCashUSD`, `bestProgram`, `tags`, `emoji`/`imageHint` already exist. **Suggested additions** to `Destination`: `bestMonths` (e.g. "Mar-Apr, Oct-Nov"), `sweetSpot` (structured: `{program, metal, milesOW, note}`), `whenToGoNote`, optional `hotelNote`. This lets one dataset power cards, guides, deals, *and* the concierge's grounding context.

---

## 4. SEO / discovery angle

This audience searches in **two distinct modes**, and hop should capture both:

**A. High-intent transactional ("I have points, where/how"):** these convert.
- `how to get to [Japan/Europe/Hawaii] with points`
- `best use of [Amex / Chase / Capital One / Bilt] points`
- `[program] sweet spots` / `[program] award chart 2026`
- `how to book ANA first class with points`
- `cheapest way to fly business class to [region] with miles`
- `[Amex/Chase] transfer partners` / `transfer bonus [month/year]`

**B. Inspirational / wanderlust (top-of-funnel):**
- `where can I go with [N] points`  ← hop owns this uniquely
- `points destinations [season]` / `cherry blossom japan points`
- `best places to use points`

**What ranks (and how hop competes):** the SERP for these is dominated by TPG, NerdWallet, Upgraded Points, Frequent Miler, AwardWallet — deep, frequently-updated, schema-rich pages. hop won't out-prose them. hop's wedges:
1. **Programmatic personalized pages** — "where can I go with 100,000 Amex points" templated across currency × balance bands. Unique angle competitors structurally can't match (they're static).
2. **Freshness** — live award space + transfer bonuses, auto-updated. Date-stamp content ("verified June 2026"); the blogs win partly on recency signals, so automate yours.
3. **Structured data** — mark up sweet-spot guides with FAQ/HowTo schema; the dataset already exists, so generation is cheap.
4. **Internal linking mesh** — destination card → its sweet-spot guide → the program guide → transfer-partner guide → back to deals. Each P0/P1 type links to the others.
5. **The tool as content** — a free "what's my point worth / where can I go" calculator earns links and ranks on its own.

**Priority SEO build order:** (1) program guides ("best use of Amex points" — huge volume), (2) sweet-spot guides (exact-route intent), (3) "how to get to X with points" destination-anchored pages, (4) programmatic "[N] points" pages once the dataset is solid.

Sources: [TPG Japan-with-points](https://thepointsguy.com/loyalty-programs/travel-to-japan-with-points-and-miles/), [Upgraded Points — fly to Japan](https://upgradedpoints.com/travel/best-ways-to-fly-to-japan-with-points/), [NerdWallet — best Amex transfer partners](https://www.nerdwallet.com/travel/learn/the-best-amex-transfer-partners-and-ones-to-avoid).

---

## 5. AI concierge — top 10 seed prompts

Real questions a points traveler would ask, chosen to (a) show off hop's grounded data — balances, cpp, destination set — and (b) cover the funnel from dreamer to ready-to-book. Use these as the suggested-prompt chips on `/ask`. The concierge already grounds answers in the user's `totalPoints` + `destinationsSummary()`, so these are answerable today.

1. **"Where can I go right now with the points I have?"** — the flagship. Grounds in real balances → destination set.
2. **"What's the best value flight I can book with my points this month?"** — ranks destinations by live cpp.
3. **"I want to go to Japan — what's the smartest way to get there with points?"** — surfaces the ANA/JAL/Avios sweet spots.
4. **"Should I book this with points or pay cash?"** — hop's core thesis, as a conversation.
5. **"What are my points actually worth?"** — valuation + cpp explainer, personalized.
6. **"Best use of my Amex / Chase points?"** — transfer-partner + sweet-spot guidance per currency.
7. **"Where can I fly business class for the fewest points?"** — premium-cabin sweet spots (Turkish, Aeroplan, Alaska/Cathay).
8. **"Cheap beach/sun trip with points in [month]?"** — vibe + season + cost, pulls from tags + bestMonths.
9. **"Is there a transfer bonus I should use before transferring?"** — time-sensitive, drives action (needs bonus data feed).
10. **"Plan me a 10-day trip somewhere warm under [N] points."** — open-ended itinerary, showcases concierge range.

Runner-ups worth rotating in: *"What can I do with 50,000 leftover points?"*, *"Where should I go for cherry blossom season?"*, *"How do I avoid fuel surcharges?"*, *"Cheapest way to Hawaii with points?"*

---

## Bottom line

Build the four data-backed P0 surfaces first — they're hop's moat and mostly scaffolded already (`destinations.ts`, `DealCard.tsx`, `/ask` concierge). Use the sweet-spots table as seed reference data (verify live; flag dynamic-priced programs). Win SEO not by out-writing TPG but by being *personalized, fresh, and structured* — programmatic "where can I go with N points" pages plus auto-updated sweet-spot/program guides. Seed the concierge with the 10 prompts above to immediately demonstrate the balances + cpp + destinations grounding hop already has.
