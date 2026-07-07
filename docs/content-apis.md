# hop content APIs + patterns — how to make non-slop content, agentically

A buyer's guide to the **free, low-friction data sources and proven patterns** hop can wire in to
manufacture genuinely good destination content — computed and cited, not LLM-generated. Researched and
**adversarially verified June 2026** (every pricing/licensing claim below was checked against the
provider's current docs by a second pass; the things that didn't survive are called out in §8).

This is a companion to `docs/content-plan.md`: that doc decides *what* content to build; this one
decides *which data* makes it real, and *how to wire it in without creating slop or fragility*.

Quick navigation:
- §1 — the bar every source must clear (hop's house rules as selection criteria)
- §2 — the shortlist: adopt now
- §3 — the one pattern that makes all of it safe (fetch-once, self-host, compute the credit)
- §4 — category matrices (imagery · dynamic images · climate · currency · place-facts · events)
- §5 — the two signature "awe" moves
- §6 — proven content patterns (programmatic + grounded + fresh + personalized)
- §7 — what ships now, and the roadmap after
- §8 — verification notes (claims that were wrong or unconfirmed — read before you build)
- §9 — sources

---

## 1. The bar: hop's house rules *are* the selection criteria

hop's architecture already encodes strong opinions (`AGENTS.md`). They double as a filter that
eliminates most of the content-API market before we spend a line of code:

| House rule | What it rules out | What it rewards |
|---|---|---|
| **Every number is computed, never generated** | AI-written "facts," AI imagery, crowd-sourced numbers presented as truth | Sources you can *compute from* — climate normals, FX, CC0 facts |
| **Lazy env; the app builds with no keys** | Anything that hard-fails without a secret | **Keyless** or fetch-once-at-ingest sources |
| **Graceful degradation (`{ok:false}`, per-section)** | APIs that suspend your account at quota (assets go dark) | Sources where a miss → a flat fallback, never a crash |
| **Flat editorial; restrained motion** | Glowy map widgets, autoplay video heroes, gradient chart libs | Flat SVG/`div` viz drawn in hop's existing value-bar language |
| **Commercial product** | Non-commercial-only data (CC BY-NC), R&D-only free tiers | Commercial-OK licenses (CC0, CC BY, public domain) |

**The decisive consequence:** because hop's destination set is *small and static* (~35–60 cities), almost
every "API" here should be hit **once at ingest/build**, its result stored, and the live site served from
hop's own data. That single move (see §3) neutralizes rate limits, hotlink rules, non-commercial *endpoint*
terms, and uptime — and turns "calling an API" into "owning a dataset."

---

## 2. The shortlist — adopt now

Ranked by leverage against hop's *specific* slop liabilities. All are **keyless or free**, commercial-OK,
and fit graceful degradation.

| # | Source | De-slops… | Why it wins | Effort |
|---|---|---|---|---|
| 1 | **Open-Meteo** historical (ERA5) → committed monthly normals | the generic region "when to go" blurb (`SEASON_BY_REGION`) | Real per-city climate normals → a computed shoulder-season window with a named comfort-band constant, exactly like `POINTS_THRESHOLD_CPP`. Data is **CC BY 4.0** (redistributable); fetch once, never poll prod. | Med |
| 2 | **next/og** computed-number share cards | the absence of any per-page social image | The signature move: mint a flat card stamped with the **same `lib/cpp` verdict** the page shows. The share image answers the question before the click. Engine already exists. | Med |
| 3 | **Wikidata SPARQL** (CC0 facts) | the tag-derived "good to know" filler | Official language, currency, timezone, population as **CC0** machine-readable values, restated in hop's voice. Zero attribution burden. | Med |
| 4 | **Unsplash** (fetch-once + self-host + computed credit) | generic visual context per destination | Highest-coverage real editorial photo source for world cities; API returns a **blurhash** for an instant flat placeholder = the degradation state. | Med |
| 5 | **Frankfurter** (keyless FX) + **Big Mac** + **World Bank PPP** | nothing yet — adds a *new* computed signal | "How far your dollar goes": live USD→local + a price-level line. Three free/keyless/commercial-OK layers, every number sourced. | Low |
| 6 | **schema.org** Place/FAQPage/Article(`dateModified`) | trust + AI-engine legibility | Pure markup. `dateModified` stamped from the data refresh is an honest freshness signal that pairs with the 6h cron. | Low |
| 7 | **Ticketmaster Discovery v2** | the lack of any *timely* content | Real dated events filtered by geo **and the user's trip dates**; affiliate buy-link slots into the existing Kiwi CTA convention. | Med |

---

## 3. The pattern that makes all of it safe: fetch-once, self-host, compute the credit

This is the load-bearing idea. Do **not** call these services at request time. At ingest (a script, or the
existing 6h cron for the volatile ones):

1. **Resolve once** — geocode each destination, store coords/QIDs in the destination row.
2. **Pull once** — one call per city per source; store the *derived* values (monthly normals, the FX number,
   the photo URL + blurhash + photographer, the CC0 facts).
3. **Compute the attribution**, don't guess it — Wikimedia/Unsplash/CC sources return the license + author in
   the response, so the credit line is *computed* like everything else hop ships.
4. **Serve from hop's store** behind an `{ok:false}` fallback, exactly like `lib/duffel.ts` et al.

Why it matters, concretely:
- **Rate limits evaporate.** Unsplash 50/hr demo, Wikidata's 60s query budget, Nominatim's 1 req/s — all
  irrelevant when you touch them ~35 times, once.
- **Non-commercial *endpoint* terms stop applying.** Open-Meteo's free endpoint is non-commercial, but the
  **data** is CC BY 4.0 and redistributable — so ingest-then-store is the clean, legal path.
- **The placeholder becomes the resilience layer.** A stored blurhash renders even when the photo CDN is
  down. The flat blur-up *is* the graceful-degradation state and respects the transform-only motion rule.

---

## 4. Category matrices

Legend: **adopt** / consider / avoid. "keyless" = usable with no signup. All facts verified June 2026.

### 4a. Imagery (real photos, not AI)
| Source | Verdict | Keyless | Free tier | Commercial | Attribution |
|---|---|---|---|---|---|
| **Unsplash** | **adopt** | no | 50 req/hr demo, 1000/hr prod | yes | **Required by API Guidelines** (stricter than the license): credit photographer + Unsplash w/ UTM links, hotlink the CDN URL, fire the download-tracking endpoint |
| **Wikimedia Commons** | **adopt** (keyless + doubles as fact source) | yes | unlimited, polite | per-file (filter to commercial-OK) | per-license; `extmetadata` returns Artist/License so the credit is **computable** |
| **Pexels** | adopt (fallback) | no | 200/hr, 20k/mo | yes | required for API use |
| **Pixabay** | consider | no | 100/min | yes | **no permanent hotlinking** — must self-host, cache 24h |
| next/image + sharp · **BlurHash/ThumbHash** · smartcrop.js | **adopt** | yes | free (in-stack) | yes | none |
| Flickr · MapTiler · imgix · Cloudinary-as-core | avoid | — | paid/non-commercial/suspend-at-quota | — | — |

### 4b. Dynamic "thinking images" (designed, computed — not generated)
| Source | Verdict | Notes |
|---|---|---|
| **next/og (`ImageResponse`)** | **adopt** | Already in repo (`app/opengraph-image.tsx`). Constraints: **flexbox only** (no grid), **no CSS variables** (inline computed hex), fonts must be **TTF/OTF** (no WOFF2). |
| **`generateImageMetadata`** | **adopt** | One static card per program/destination, pre-rendered. |
| flat SVG/`div` data-viz | **adopt** | Deterministic, dependency-free, identical to hop's value-bar language. |
| static map images (Stadia/Geoapify) | consider | OSM attribution required; nice-to-have, not core. |

### 4c. Climate / seasonality
| Source | Verdict | Keyless | License | Note |
|---|---|---|---|---|
| **Open-Meteo historical (ERA5)** | **adopt** | yes | **CC BY 4.0 data** | Fetch-once-at-ingest. Credit: "Weather data by Open-Meteo.com". The free *endpoint* is non-commercial — the *data* isn't. |
| Open-Meteo Climate (CMIP6) | consider | yes | CC BY 4.0 | For future-looking ranges; ERA5 is the right base. |
| NOAA/NCEI U.S. Normals | consider | key | public domain | US-only; good for HNL/OGG/US cities. |
| Meteostat | **avoid** | no | **CC BY-NC** | NonCommercial — disqualified for a commercial product. |
| WeatherAPI.com | avoid | no | — | history too shallow for normals. |

### 4d. Currency / cost-of-travel
| Source | Verdict | Keyless | License |
|---|---|---|---|
| **Frankfurter** | **adopt** | yes | open (ECB data) — credit ECB lightly |
| **Big Mac Index** (Economist repo) | **adopt** | yes | CC BY 4.0 |
| **World Bank PPP / price level** | **adopt** | yes | CC BY 4.0 |
| ECB reference rates (raw) | consider | yes | cite ECB |
| open.er-api.com | consider | yes | mandatory "Rates By Exchange Rate API" link |
| exchangerate.host · Numbeo | avoid | — | now key-capped / paid-only ($260+/mo) |

### 4e. Structured place-facts (de-slop "good to know")
| Source | Verdict | Keyless | License |
|---|---|---|---|
| **Wikidata SPARQL** | **adopt** | yes | **CC0** (no burden) |
| **CIA World Factbook JSON** | **adopt** (vendor it) | yes | CC0 / public domain |
| **sunrise-sunset.org** (daylight) | **adopt** | yes | free w/ attribution |
| **Passport Index** dataset (visa-free) | consider (vendor it) | yes | MIT; point-in-time → date-stamp it |
| countries.dev · Wikipedia REST · GeoNames · Nominatim/Overpass · OpenHolidays | consider | mostly yes | CC BY / CC BY-SA / ODbL — attribution/share-alike applies |
| **REST Countries** | **avoid** | no | now key-gated (500/mo) — use Wikidata/countries.dev |
| Calendarific · tipping datasets | avoid | — | key-gated / none exist |

### 4f. Events / "what's on" (the only freshness signal)
| Source | Verdict | Keyless | Note |
|---|---|---|---|
| **Ticketmaster Discovery v2** | **adopt** | no (free key) | 5 req/s, 5k/day. Commercial path = **Affiliate Program** (General Terms forbid "deriving revenues from the API"); **short cache only**, no long-term DB store; 24h takedown. |
| Open civic/tourism ICS feeds | consider | yes | per-city, no aggregation; good keyless fallback. |
| PredictHQ · SeatGeek | consider | no | enterprise / partner-gated. |
| Songkick · Eventbrite · Bandsintown | avoid | — | non-commercial / discovery killed / consent-gated. |

---

## 5. The two signature "awe" moves

Both stay inside the flat-editorial, computed-not-generated bar — that's *why* they differentiate.

**1. The computed-number OG card.** Every search, sweet-spot, and destination page mints a flat card stamped
with the same deterministic verdict the page shows — `PHX→LHR · 60k pts or $812 · cpp 2.9¢ · USE POINTS`,
green tier bar, the hop bunny. The share image answers the question *before the click*. Competitors can't
fake this with AI text — the number is computed by `lib/cpp`/`lib/search`, drawn in the value-bar + bunny
language hop already ships, and it degrades to the existing static brand card when `degraded[]` is non-empty.

**2. The fully-computed, cited "best time to go" panel.** Fuse three free/keyless layers into one terse,
date-stamped verdict per city: **Open-Meteo** normals (a shoulder-season window from a named comfort-band
constant), **Frankfurter + World Bank/Big Mac** ("the dollar is up 6% vs the euro; prices ~30% below US"),
and a dated **Ticketmaster** "what's on while you're there" strip. Each number sourced and stamped, none
generated. This applies hop's verdict-engine ethos to the *whole trip*, not just the fare.

---

## 6. Proven content patterns (the "agentically, without slop" part)

| Pattern | What it is | Why it beats generic AI content |
|---|---|---|
| **Programmatic SEO grounded in computed data** | Templated pages whose differentiator is data the competitor can't cheaply fake (hop's cpp, balances, normals). | TPG/NerdWallet win on prose; hop wins on *being personalized, fresh, and structured*. The template is cheap; the **data is the moat**. |
| **Generate-then-ground (LLM as arranger, not author)** | The model *arranges* real values into copy; it never invents the numbers. | Grounding cuts hallucination sharply (grounded answers ~92% vs ~38% freestanding on SimpleQA-style probes). Matches "every number computed." |
| **Freshness date-stamping + schema.org** | `Article.dateModified` from the data refresh + Place/FAQPage JSON-LD. | After Google's 2025–26 changes, valid structured data + genuine freshness is how templated pages earn **AI-engine citation** (rich-result cards mostly went to gov/health). |
| **Edge / geo personalization** | Read Vercel edge geo in `middleware.ts` to default the origin airport (LHR for a London visitor). | One static template → per-visitor relevance, no render round-trip, country-level only as a soft default. |
| **Tool as content** | The "where can I go with N points" calculator ranks and earns links on its own. | Interactive + computed; structurally un-fakeable by a static blog. |

---

## 7. What ships now, and the roadmap

The two signature proofs of the approach, in order:

1. **Climate "when to go" — shipped.** Open-Meteo ERA5 normals, baked into committed seed data
   (`lib/climate-normals.ts`), turned into an honest per-city window by a deterministic, tested
   `lib/climate.ts` and rendered as a flat 12-month strip on `/destinations/[city]`. Replaces the
   generic `SEASON_BY_REGION` prose.
2. **Computed-number OG cards — next (follow-up PR).** Per-destination and per-program `next/og` cards
   carrying the computed cpp + value tier, in the bunny/value-bar brand language.

**Quick wins (each <1 day, keyless, no new infra):**
- `lib/fx.ts` → Frankfurter on the existing cron; a "how far your dollar goes" line with the ECB source date.
- `next/image placeholder="blur"` across destination cards/heroes using a stored blurhash — instant
  perceived-load de-slop *and* a free degradation state.
- Place + Article(`dateModified`) + FAQPage JSON-LD on `/destinations/[city]` — pure markup, AI-citation payoff.
- Edge-geo origin default in `middleware.ts` — LHR for a London visitor, not a US default.
- Vendor the Big Mac CSV (CC BY) + CIA Factbook JSON (CC0) to ground country facts with zero runtime dependency.

**Next:** Wikidata fact chips (currency/language/timezone) → Unsplash photo-per-destination (fetch-once,
self-hosted, computed credit) → Ticketmaster dated-events strip (affiliate-wrapped, short cache).

**The architectural shape for all of it** mirrors what hop already does: an **ingest step** writes derived
values into the destination store; a `lib/*` client returns a discriminated `{ok}` result and never throws;
the UI renders the section or degrades it. New content data flows through the same spine as cash/awards/balances.

---

## 8. Verification notes — read before you build

The adversarial pass overturned or could not confirm several common claims. Building on the un-checked
version would be a real mistake:

- **`@vercel/og` and Satori are MPL-2.0, *not* MIT.** Confirmed against the bundled `LICENSE` files; only
  Next.js itself is MIT. MPL-2.0 is *weak, file-level* copyleft — **safe** to depend on for hop's web app with
  no obligation on hop's own code — but record it correctly.
- **Open-Meteo's free *endpoint* is non-commercial.** The escape hatch is the **data license (CC BY 4.0)** +
  fetch-once-at-ingest + the "Weather data by Open-Meteo.com" credit. Don't poll it from production.
- **REST Countries is no longer keyless** (now Bearer-key, ~500 req/mo). Prefer Wikidata (CC0) / countries.dev
  (GeoNames CC BY). REST Countries' "all upstreams are CC0" claim is also false — GeoNames is CC BY.
- **Ticketmaster:** the main Discovery **v2** endpoint already covers UK/EU/MX/AU/NZ (the "separate
  International endpoint" claim is wrong/legacy). Affiliate signup does **not** bundle API access — get the
  developer key separately. Caching is short-TTL only.
- **Meteostat is CC BY-NC** — disqualified for commercial use; Open-Meteo's CC BY ERA5 does the same job clean.
- **Nager.Date hosted-API commercial terms are unconfirmed** (the "needs sponsorship" language is about the
  Docker/NuGet variants). Prefer OpenHolidays or self-host the MIT code until confirmed.
- **Vercel geo accuracy** (~99% country / 40–70% city) is third-party, not from Vercel docs — use city-level
  as a *soft* default only, never a hard pricing/legal gate.
- **Frankfurter can update intraday** before the rate settles — cache with the source date, stale-tolerate
  weekends, rather than assuming one fixed daily value.
- **Cloudinary suspends the account at quota** (assets go dark) rather than billing overage — fights graceful
  degradation; don't make it core infra. Precompute crops with sharp/smartcrop at build instead.

---

## 9. Sources

Climate/data: [Open-Meteo](https://open-meteo.com/) (ERA5 historical, CC BY 4.0), [Open-Meteo licensing](https://open-meteo.com/en/license).
Imagery: [Unsplash API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines), [Pexels API](https://www.pexels.com/api/documentation/), [Wikimedia Commons API](https://commons.wikimedia.org/wiki/Commons:API), [Pixabay API](https://pixabay.com/api/docs/).
Dynamic images: [next/og](https://nextjs.org/docs/app/api-reference/functions/image-response), [Satori](https://github.com/vercel/satori), [generateImageMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-image-metadata).
Currency: [Frankfurter](https://frankfurter.dev/), [Big Mac Index data](https://github.com/TheEconomist/big-mac-data), [World Bank Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392).
Facts: [Wikidata Query Service](https://query.wikidata.org/), [CIA World Factbook JSON](https://github.com/factbook/factbook.json), [sunrise-sunset.org](https://sunrise-sunset.org/api), [Passport Index dataset](https://github.com/ilyankou/passport-index-dataset).
Events: [Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/).
Patterns: [Google structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data), [Vercel Edge geolocation](https://vercel.com/docs/edge-network/headers/request-headers).

---

## Bottom line

The market is mostly noise for a product with hop's bar; the signal is small. Lead with **Open-Meteo climate
normals** (kills the worst slop liability with real computed data) and **next/og computed-number cards** (the
share image that answers the question) — both keyless, both already validated here, both pure "computed, not
generated." Wire everything **fetch-once → self-host → compute the credit** so rate limits and non-commercial
endpoints stop mattering. Then layer FX, CC0 facts, and dated events into one cited "best time to go" verdict —
hop's verdict engine, applied to the whole trip.
