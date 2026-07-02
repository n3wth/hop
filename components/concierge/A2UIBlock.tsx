'use client'

import Link from 'next/link'
import { useState } from 'react'
import { dismissVerdict } from '@/app/ask/verdict-actions'

// A2UIBlock — the CLIENT-OWNED renderer for the agent-to-UI spec (lib/a2ui.ts).
// The agent emits a typed, CLOSED-union block; THIS file decides how each block
// LOOKS. The model never sends HTML, classes, or colors — only structured fields
// — so every block here is guaranteed on-brand (brand tokens only) and flat (no
// shadows/gradients-as-decoration/glows; hover = color only). Economics shown on
// verdict_card / compare come from `econ`, which the SERVER stamped from hop's
// engine — never from the model.
//
// The verdict_card / compare blocks speak the SAME visual language as the
// signature VerdictRail: lead with the "$X vs cash" savings, the same labeled
// stat strip (You pay / Value / Cash price), and the same verdict color. So an
// agent verdict reads as a compact instance of the one engine voice.
//
// OWNERSHIP VOICE: `hasBalances` (threaded from the server, true only when the
// signed-in visitor's real balances are in play) gates first-person possession.
// Signed-out / no balances → value framing ("Priced this route", "Value per
// point") and never "you have"/"with your points" — the points belong to no one
// we know.
//
// Unknown/invalid blocks never reach here: parseA2UI() drops them. As a final
// belt-and-suspenders, the switch returns null for anything unexpected.

import Icon from '../Icon'
import type {
  A2UIBlock,
  A2UIEconomics,
  VerdictCardBlock,
  CompareBlock,
  TimingBlock,
  WeatherBlock,
  WebNoteBlock,
  PromptChipsBlock,
  ProfileConfirmBlock,
  ConnectGmailBlock,
  CounterfactualBlock,
} from '@/lib/a2ui'

// A destination block links into a real hop search seeded to that city — and,
// when we know it, the visitor's home airport (`from`) so the search lands
// fully-formed instead of falling back to the default origin. Dates aren't
// carried on a2ui blocks, so /search clamps depart to today on arrival.
function searchHref(code: string, from?: string): string {
  const params = new URLSearchParams({ to: code })
  const origin = from?.trim().toUpperCase()
  if (origin) params.set('from', origin)
  return `/search?${params.toString()}`
}

// Render a list of blocks. Each block is self-contained + on-brand. `hasBalances`
// gates the ownership voice (see file header) on verdict_card / compare.
export function A2UIBlocks({
  blocks,
  onChip,
  hasBalances = false,
  homeAirport,
  gmailEnabled = false,
  onConnectGmail,
}: {
  blocks: A2UIBlock[]
  onChip?: (prompt: string) => void
  hasBalances?: boolean
  /** The visitor's home airport — seeds `from` on every "See the search" link. */
  homeAirport?: string
  /** Gmail seam live (env flag + Google creds) → connect_gmail is a real button. */
  gmailEnabled?: boolean
  /** Invoked by a live connect_gmail block (routes to login / OAuth start). */
  onConnectGmail?: () => void
}) {
  if (!blocks.length) return null
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => (
        <A2UIBlockView
          key={`${b.type}-${i}`}
          block={b}
          onChip={onChip}
          hasBalances={hasBalances}
          homeAirport={homeAirport}
          gmailEnabled={gmailEnabled}
          onConnectGmail={onConnectGmail}
        />
      ))}
    </div>
  )
}

// Render ONE block. The switch is exhaustive over the closed union.
export function A2UIBlockView({
  block,
  onChip,
  hasBalances = false,
  homeAirport,
  gmailEnabled = false,
  onConnectGmail,
}: {
  block: A2UIBlock
  onChip?: (prompt: string) => void
  hasBalances?: boolean
  homeAirport?: string
  gmailEnabled?: boolean
  onConnectGmail?: () => void
}) {
  switch (block.type) {
    case 'verdict_card':
      return <VerdictCard b={block} hasBalances={hasBalances} homeAirport={homeAirport} />
    case 'compare':
      return <Compare b={block} hasBalances={hasBalances} homeAirport={homeAirport} />
    case 'timing':
      return <Timing b={block} />
    case 'weather':
      return <Weather b={block} />
    case 'web_note':
      return <WebNote b={block} />
    case 'prompt_chips':
      return <PromptChips b={block} onChip={onChip} />
    case 'profile_confirm':
      return <ProfileConfirm b={block} />
    case 'connect_gmail':
      return <ConnectGmail b={block} gmailEnabled={gmailEnabled} onConnect={onConnectGmail} />
    case 'counterfactual':
      return <Counterfactual b={block} homeAirport={homeAirport} />
    default:
      // Never reached for a valid union member — defensive only.
      return null
  }
}

// ── Shared bits — the VerdictRail vocabulary, compact ─────────────────────────

// The one-glance verdict pill. Solid fill, brand tokens, no emoji. Same call
// language as VerdictRail's "Best value" / "Pay cash" verdict.
function VerdictPill({ verdict, cpp }: { verdict: A2UIEconomics['verdict']; cpp?: number }) {
  const label =
    verdict === 'points' ? 'Use points' : verdict === 'cash' ? 'Pay cash' : 'Save toward'
  // Brand teal for the points win (matches VerdictRail), warm ochre for save,
  // muted ink for cash — the same three-state palette the rail uses.
  const bg =
    verdict === 'points'
      ? 'var(--color-brand)'
      : verdict === 'cash'
        ? 'var(--color-cash)'
        : 'var(--color-warn)'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white"
      style={{ background: bg }}
    >
      {label}
      {verdict === 'points' && cpp != null ? (
        <span className="hop-num">· {cpp.toFixed(1)}¢/pt</span>
      ) : null}
    </span>
  )
}

// The savings hero — VerdictRail's signature "$X vs cash" moment, miniaturized.
// On a points win it leads with the dollars skipped; on cash/save it states the
// cash price plainly. Numbers are engine-stamped (econ), never model-authored.
function SavingsLead({ econ }: { econ: A2UIEconomics }) {
  if (econ.verdict === 'points') {
    // Cash you skip by flying on points = the cash price (award taxes are
    // negligible in the dataset, mirroring VerdictRail's saveVsCash framing).
    const save = Math.round(econ.cashUsd)
    return (
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="hop-price text-[30px] leading-[0.95] text-brand">
          ${save.toLocaleString('en-US')}
        </span>
        <span className="font-display text-[13px] font-semibold leading-tight tracking-[-0.01em] text-text2">
          vs&nbsp;cash
        </span>
      </div>
    )
  }
  return (
    <div className="mt-2.5 flex items-baseline gap-1.5">
      <span className="hop-price text-[24px] leading-[0.95] text-text">
        ${Math.round(econ.cashUsd).toLocaleString('en-US')}
      </span>
      <span className="text-[12px] font-medium text-text3">cash{econ.verdict === 'save' ? ' · save toward it' : ''}</span>
    </div>
  )
}

// One labeled stat in VerdictRail's strip vocabulary (small caps label over a
// display-weight value). `accent` paints the value brand-teal for the hero stat.
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text3">
        {label}
      </div>
      <div
        className={`hop-num text-[15px] font-semibold leading-none ${accent ? 'text-brand' : 'text-text'}`}
      >
        {value}
      </div>
    </div>
  )
}

// The engine-computed stat strip — VerdictRail's "You pay / Value / Cash price /
// You save" treatment, compact. Renders nothing if econ is absent (destination
// not in the dataset) — degrades to reason-only. `hasBalances` swaps the
// ownership label: "You pay" (the visitor's own points win) vs the neutral
// "Points" for a signed-out value demonstration.
function EconFacts({ econ, hasBalances }: { econ?: A2UIEconomics; hasBalances: boolean }) {
  if (!econ) return null
  const owns = hasBalances && econ.youHave != null
  const points = `${Math.round(econ.milesNeeded / 1000)}k`
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-x-5 gap-y-2.5">
        <Stat label={owns ? 'You pay' : 'Points'} value={points} />
        {econ.cpp != null ? <Stat label="Value" value={`${econ.cpp.toFixed(1)}¢/pt`} /> : null}
        <Stat label="Cash price" value={`$${Math.round(econ.cashUsd).toLocaleString('en-US')}`} />
        {econ.verdict === 'points' ? (
          <Stat label="You save" value={`$${Math.round(econ.cashUsd).toLocaleString('en-US')}`} accent />
        ) : null}
      </div>
      {/* program path — value framing when signed-out, possession when owned */}
      {owns ? (
        <p className="mt-2.5 text-[11.5px] leading-[1.5] text-text2">
          <b className={`hop-num font-semibold ${econ.affordable ? 'text-brand' : 'text-text'}`}>
            {econ.youHave!.toLocaleString('en-US')}
          </b>{' '}
          toward {econ.bestProgram}
          {econ.affordable ? <span className="font-semibold text-brand"> — enough</span> : ' — keep saving'}
        </p>
      ) : (
        <p className="mt-2.5 text-[11.5px] leading-[1.5] text-text3">
          Best via {econ.bestProgram}
        </p>
      )}
    </div>
  )
}

// ── verdict_card ─────────────────────────────────────────────────────────────

function VerdictCard({
  b,
  hasBalances,
  homeAirport,
}: {
  b: VerdictCardBlock
  hasBalances: boolean
  homeAirport?: string
}) {
  const econ = b.econ
  const city = econ?.city ?? b.code
  // "Not for me" — an OBSERVED dismiss (gated by the server via b.dismissable).
  // Genuinely optimistic: hide the card immediately, then record best-effort. The
  // record is a soft, gated signal, so a signed-out / dark-seam / transport-error
  // click still declutters without surfacing anything (the .catch swallows any
  // server-action rejection so it never becomes an unhandled promise rejection).
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  const dismiss = () => {
    setDismissed(true)
    void dismissVerdict(city, b.cabin).catch(() => {})
  }
  return (
    <div className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface transition-colors hover:border-brand">
      <Link href={searchHref(b.code, homeAirport)} className="flex flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[18px] font-semibold leading-tight text-text">
              {city}
            </span>
            <span className="rounded-full bg-sunk px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-text2">
              {b.code}
            </span>
          </div>
          {econ ? <VerdictPill verdict={econ.verdict} cpp={econ.cpp} /> : null}
        </div>

        {/* lead with the savings — the VerdictRail hero moment, compact */}
        {econ ? <SavingsLead econ={econ} /> : null}

        <p className="mt-2 text-[13px] leading-[1.5] text-text2">{b.reason}</p>

        {/* personalization chips — only present when the server kept them */}
        {b.fitsDays != null || b.cabin ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {b.fitsDays != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 text-[11px] font-medium text-text2">
                <Icon name="schedule" size={12} className="text-brand" />
                Fits your {b.fitsDays} days
              </span>
            ) : null}
            {b.cabin ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 text-[11px] font-medium capitalize text-text2">
                <Icon name="workspace_premium" size={12} className="text-brand" />
                {b.cabin}
              </span>
            ) : null}
          </div>
        ) : null}

        <EconFacts econ={econ} hasBalances={hasBalances} />

        <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
          See the search
          <Icon name="swap_horiz" size={16} />
        </span>
      </Link>

      {/* "Not for me" — records the pass so hop stops leading with this place.
          Server-gated: only present when b.dismissable was stamped. */}
      {b.dismissable ? (
        <button
          type="button"
          onClick={dismiss}
          aria-label={`Not for me — dismiss ${city}`}
          className="hop-press border-t border-border px-4 py-2 text-left text-[12px] font-medium text-text3 transition-colors hover:text-text2"
        >
          Not for me
        </button>
      ) : null}
    </div>
  )
}

// ── compare ──────────────────────────────────────────────────────────────────

function Compare({
  b,
  hasBalances,
  homeAirport,
}: {
  b: CompareBlock
  hasBalances: boolean
  homeAirport?: string
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text3">
        <Icon name="swap_horiz" size={16} className="text-brand" />
        Side by side
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CompareSide side={b.left} hasBalances={hasBalances} homeAirport={homeAirport} />
        <CompareSide side={b.right} hasBalances={hasBalances} homeAirport={homeAirport} />
      </div>
      {b.takeaway ? (
        <p className="mt-3 border-t border-border pt-3 text-[13px] leading-[1.5] text-text2">
          {b.takeaway}
        </p>
      ) : null}
    </div>
  )
}

function CompareSide({
  side,
  hasBalances,
  homeAirport,
}: {
  side: CompareBlock['left']
  hasBalances: boolean
  homeAirport?: string
}) {
  const econ = side.econ
  const city = econ?.city ?? side.code
  return (
    <Link
      href={searchHref(side.code, homeAirport)}
      className="group flex flex-col rounded-[var(--radius)] border border-border bg-paper p-3 transition-colors hover:border-brand"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[15px] font-semibold leading-tight text-text">{city}</span>
        {econ ? <VerdictPill verdict={econ.verdict} cpp={econ.cpp} /> : null}
      </div>
      {econ ? <SavingsLead econ={econ} /> : null}
      <p className="mt-1.5 text-[12px] leading-[1.5] text-text2">{side.reason}</p>
      <EconFacts econ={econ} hasBalances={hasBalances} />
    </Link>
  )
}

// ── timing ───────────────────────────────────────────────────────────────────

function Timing({ b }: { b: TimingBlock }) {
  const fill = (level: TimingBlock['weeks'][number]['level']) =>
    level === 'low' ? 'var(--color-brand)' : level === 'mid' ? 'var(--color-brand-light)' : 'var(--color-hair)'
  const labelFor = (level: TimingBlock['weeks'][number]['level']) =>
    level === 'low' ? 'Cheapest' : level === 'mid' ? 'Mid' : 'Pricey'
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text3">
        <Icon name="schedule" size={16} className="text-brand" />
        When to go · {b.place}
      </div>
      <div className="flex items-end gap-1.5">
        {b.weeks.map((w, i) => {
          const h = w.level === 'low' ? 18 : w.level === 'mid' ? 30 : 44
          return (
            <div key={`${w.label}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className="w-full rounded-[4px]"
                style={{ height: h, background: fill(w.level) }}
                title={labelFor(w.level)}
                aria-label={`${w.label}: ${labelFor(w.level)}`}
              />
              <span className="text-center text-[10px] leading-tight text-text3">{w.label}</span>
            </div>
          )
        })}
      </div>
      {b.note ? <p className="mt-3 text-[12px] leading-[1.5] text-text2">{b.note}</p> : null}
    </div>
  )
}

// ── weather ──────────────────────────────────────────────────────────────────

function Weather({ b }: { b: WeatherBlock }) {
  const hasTemp = b.highC != null || b.lowC != null
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text3">
          <Icon name="info" size={16} className="text-brand" />
          {b.place} · {b.month}
        </div>
        {hasTemp ? (
          <span className="hop-num text-[15px] font-semibold text-text">
            {b.lowC != null ? `${Math.round(b.lowC)}°` : ''}
            {b.lowC != null && b.highC != null ? '–' : ''}
            {b.highC != null ? `${Math.round(b.highC)}°C` : ''}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] leading-[1.5] text-text2">{b.summary}</p>
    </div>
  )
}

// ── web_note ─────────────────────────────────────────────────────────────────

function WebNote({ b }: { b: WebNoteBlock }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <p className="text-[13px] leading-[1.55] text-text2">{b.text}</p>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-text3">
        <Icon name="search" size={12} className="text-brand" />
        {b.url ? (
          <a
            href={b.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium text-text3 underline-offset-2 transition-colors hover:text-brand hover:underline"
          >
            {b.source}
          </a>
        ) : (
          <span className="font-medium">{b.source}</span>
        )}
      </div>
    </div>
  )
}

// ── prompt_chips ─────────────────────────────────────────────────────────────

function PromptChips({ b, onChip }: { b: PromptChipsBlock; onChip?: (p: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {b.chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onChip?.(chip)}
          disabled={!onChip}
          className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium text-text2 transition-colors hover:border-brand hover:text-brand disabled:cursor-default disabled:hover:border-border disabled:hover:text-text2"
        >
          {chip}
        </button>
      ))}
    </div>
  )
}

// ── profile_confirm ──────────────────────────────────────────────────────────

function ProfileConfirm({ b }: { b: ProfileConfirmBlock }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-border bg-sunk p-3.5">
      <Icon name="check_circle" size={16} weight="fill" className="flex-shrink-0 text-brand" />
      <span className="text-[13px] leading-[1.5] text-text2">
        <span className="font-semibold text-text">Got it.</span> {b.fact}
      </span>
    </div>
  )
}

// ── connect_gmail ────────────────────────────────────────────────────────────

// `gmailEnabled` (threaded from the server via env.isGmailHistoryEnabled) flips
// this from an honest disabled "Soon" affordance to a LIVE connect button. The
// `onConnect` handler (Concierge) routes signed-out → /auth/login?returnTo=/ask
// and signed-in → /auth/gmail/start; the start route self-gates as a backstop.
function ConnectGmail({
  b,
  gmailEnabled = false,
  onConnect,
}: {
  b: ConnectGmailBlock
  gmailEnabled?: boolean
  onConnect?: () => void
}) {
  const live = gmailEnabled && !!onConnect
  return (
    <div className="flex flex-col gap-2.5 rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <Icon name="envelope" size={16} className="mt-0.5 flex-shrink-0 text-brand" />
        <span className="text-[13px] leading-[1.5] text-text2">
          <span className="font-semibold text-text">Connect Gmail</span>
          {b.reason ? ` ${b.reason}` : ' so hop can learn from your past trips.'}
        </span>
      </div>
      {live ? (
        <button
          type="button"
          onClick={onConnect}
          className="flex flex-shrink-0 items-center gap-1.5 self-start rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-text transition-colors hover:border-brand hover:text-brand sm:self-auto"
        >
          Connect
          <Icon name="swap_horiz" size={16} />
        </button>
      ) : (
        <button
          type="button"
          disabled
          title="Coming soon"
          className="flex flex-shrink-0 cursor-not-allowed items-center gap-1.5 self-start rounded-full border border-border bg-sunk px-3.5 py-1.5 text-[12px] font-semibold text-text3 sm:self-auto"
        >
          Connect
          <span className="rounded-full bg-paper px-1.5 py-px text-[10px] uppercase tracking-wide text-text3">
            Soon
          </span>
        </button>
      )}
    </div>
  )
}

// ── counterfactual ───────────────────────────────────────────────────────────

// COUNTERFACTUAL YOU, inline. The unlock count + dollar value + cities come from
// `result`, which the SERVER stamped by running hop's deterministic engine over
// the user's real balances — never the model. Renders nothing useful if result is
// absent (mutation didn't resolve to a known program).
function Counterfactual({ b, homeAirport }: { b: CounterfactualBlock; homeAirport?: string }) {
  const r = b.result
  if (!r) return null
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text3">
        <Icon name="swap_horiz" size={16} className="text-brand" />
        What if · {r.label}
      </div>
      {r.unlockedCount > 0 ? (
        <p className="font-display text-[15px] font-semibold leading-snug tracking-[-0.01em] text-text">
          Unlocks {r.unlockedCount} {r.unlockedCount === 1 ? 'trip' : 'trips'} worth about{' '}
          <span className="hop-num text-brand">${r.dollarValue.toLocaleString('en-US')}</span> in
          cash flights.
        </p>
      ) : (
        <p className="text-[13px] leading-[1.5] text-text2">
          No new trips cross the line with that change.
        </p>
      )}
      {r.unlocked.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.unlocked.map((d) => (
            <Link
              key={d.code}
              href={searchHref(d.code, homeAirport)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-paper px-2.5 py-1 text-[12px] font-medium text-text2 transition-colors hover:border-brand hover:text-brand"
            >
              <span
                className={`fi fi-${d.countryCode} h-[11px] w-[15px] flex-shrink-0 rounded-[1px]`}
                aria-hidden
              />
              {d.city}
              {d.cpp != null ? (
                <span className="hop-num text-text3">{d.cpp.toFixed(1)}¢/pt</span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default A2UIBlocks
