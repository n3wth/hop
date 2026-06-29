'use client'

// AI Elements — Tool (themed for hop).
// Adopts the official <Tool>/<ToolHeader>/<ToolContent> collapsible structure
// and its state model (input-streaming → input-available → output-available /
// output-error), restyled to hop's flat house style with a native <details>
// disclosure (no radix). It narrates the agent's mid-thought tool use in plain,
// warm language — "Searching the web…", "Checking weather…", "Pricing with your
// points…" — with a quiet brand spinner while running and a check when done.
//
// This file also exposes ToolActivity: a compact, render-ready view over hop's
// concierge tool stream (web_search / get_weather / price_trip / save_profile_fact),
// so the conversation can show tool activity without the caller wiring header +
// content + state badges by hand.

import type { ComponentProps, ReactNode } from 'react'
import Icon, { type IconName } from '../Icon'
import { Loader } from './loader'

export type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

export type ToolProps = ComponentProps<'details'>

export function Tool({ className = '', ...props }: ToolProps) {
  return (
    <details
      className={`group/tool not-prose w-full overflow-hidden rounded-[12px] border border-border bg-surface ${className}`}
      {...props}
    />
  )
}

export type ToolHeaderProps = {
  title: string
  icon?: IconName
  state: ToolState
  className?: string
}

// The disclosure row: tool icon + friendly title + a status affordance. Running
// shows the brand Loader; done shows a check; error shows the error glyph. Color
// is the only thing that changes on hover (house rule — no lift).
export function ToolHeader({ title, icon = 'lightbulb', state, className = '' }: ToolHeaderProps) {
  const running = state === 'input-streaming' || state === 'input-available'
  const errored = state === 'output-error'
  return (
    <summary
      className={`flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-2.5 text-text2 transition-colors hover:text-text [&::-webkit-details-marker]:hidden ${className}`}
    >
      <Icon name={icon} size={16} className={running ? 'text-brand hop-pulse' : 'text-text3'} />
      <span className="text-[13px] font-medium">{title}</span>
      <span className="ml-auto inline-flex items-center text-text3">
        {running ? (
          <Loader size={14} className="text-brand" />
        ) : errored ? (
          <Icon name="error" size={15} className="text-[#9a6a2e]" />
        ) : (
          <Icon name="check_circle" size={15} className="text-brand" />
        )}
      </span>
      <Icon
        name="expand_more"
        size={16}
        className="text-text3 transition-transform group-open/tool:rotate-180"
      />
    </summary>
  )
}

export type ToolContentProps = ComponentProps<'div'>

export function ToolContent({ className = '', ...props }: ToolContentProps) {
  return (
    <div className={`border-t border-hair px-3.5 py-3 text-[12px] text-text2 ${className}`} {...props} />
  )
}

// --- Convenience: hop's tool-activity model ---------------------------------

// One step of agent tool use as surfaced by the concierge stream. `label` is the
// human line shown in the header; `detail` (optional) is the small expandable
// note (e.g. the place priced, the search objective).
export interface ToolActivityStep {
  tool: string
  state: ToolState
  detail?: string
}

// Friendly, warm copy per concierge tool — present-progressive while running,
// settled once done. No emoji. Falls back to a humanized tool name.
const TOOL_COPY: Record<string, { icon: IconName; running: string; done: string }> = {
  web_search: { icon: 'search', running: 'Searching the web…', done: 'Searched the web' },
  get_weather: { icon: 'schedule', running: 'Checking the weather…', done: 'Checked the weather' },
  price_trip: { icon: 'credit_card', running: 'Pricing with your points…', done: 'Priced with your points' },
  save_profile_fact: { icon: 'loyalty', running: 'Remembering that…', done: 'Saved to your profile' },
}

function humanize(tool: string): string {
  return tool.replace(/_/g, ' ')
}

export function toolTitle(step: ToolActivityStep): string {
  const copy = TOOL_COPY[step.tool]
  const running = step.state === 'input-streaming' || step.state === 'input-available'
  if (copy) return running ? copy.running : copy.done
  return running ? `Working: ${humanize(step.tool)}…` : `Used ${humanize(step.tool)}`
}

export function toolIcon(step: ToolActivityStep): IconName {
  return TOOL_COPY[step.tool]?.icon ?? 'lightbulb'
}

// Strip the verb prefix ("Pricing "/"Searching "/"Checking ") and the trailing
// " against your points" / " for …" so a detail like "Pricing HNL against your
// points" collapses to just the place ("HNL"). Keeps the collapsed header self-
// identifying when several identical tool rows stack. Text only — brand-safe.
export function shortDetail(detail: string): string {
  return detail
    .replace(/^(pricing|searching|checking|saving|remembering)\s+/i, '')
    .replace(/\s+against your points$/i, '')
    .replace(/\s+with your points$/i, '')
    .trim()
}

// A ready-made tool card for one activity step. Collapsed by default; expands to
// the optional detail line. Used inside an assistant turn.
export function ToolActivity({ step, children }: { step: ToolActivityStep; children?: ReactNode }) {
  const hasDetail = !!step.detail || !!children
  // Surface the per-call detail in the collapsed header so stacked rows
  // (e.g. three price_trip calls) are legible without expanding each one.
  const suffix = step.detail ? shortDetail(step.detail) : ''
  const title = suffix ? `${toolTitle(step)} · ${suffix}` : toolTitle(step)
  return (
    <Tool>
      <ToolHeader title={title} icon={toolIcon(step)} state={step.state} />
      {hasDetail ? (
        <ToolContent>
          {step.detail ? <p className="leading-[1.5]">{step.detail}</p> : null}
          {children}
        </ToolContent>
      ) : null}
    </Tool>
  )
}

export default Tool
