'use client'

import type { ComponentProps, ReactNode } from 'react'
import Icon, { type IconName } from '../Icon'
import { Loader } from './loader'

export type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

export type ToolProps = ComponentProps<'details'>

// Lightweight: no outer card box — just a slim inline disclosure row.
export function Tool({ className = '', ...props }: ToolProps) {
  return <details className={`group/tool not-prose w-full ${className}`} {...props} />
}

export type ToolHeaderProps = {
  title: string
  icon?: IconName
  state: ToolState
  className?: string
}

// A slim pill-row: icon + title + status. Hover gets a subtle surface tint.
export function ToolHeader({ title, icon = 'lightbulb', state, className = '' }: ToolHeaderProps) {
  const running = state === 'input-streaming' || state === 'input-available'
  const errored = state === 'output-error'
  return (
    <summary
      className={`flex cursor-pointer list-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-text3 transition-colors hover:bg-surface hover:text-text2 [&::-webkit-details-marker]:hidden ${className}`}
    >
      <Icon
        name={icon}
        size={13}
        className={running ? 'text-brand hop-pulse' : errored ? 'text-amber' : 'text-text3'}
      />
      <span className="flex-1 truncate text-[12px] font-medium leading-none">{title}</span>
      <span className="ml-auto inline-flex shrink-0 items-center gap-1.5">
        {running ? (
          <Loader size={11} className="text-brand" />
        ) : errored ? (
          <Icon name="error" size={12} className="text-warn" />
        ) : (
          <Icon name="check_circle" size={12} className="text-brand/50" />
        )}
      </span>
      <Icon
        name="expand_more"
        size={13}
        className="shrink-0 text-text3/60 transition-transform group-open/tool:rotate-180"
      />
    </summary>
  )
}

export type ToolContentProps = ComponentProps<'div'>

// Indented with a left accent instead of a bordered card.
export function ToolContent({ className = '', ...props }: ToolContentProps) {
  return (
    <div
      className={`ml-5 mt-0.5 border-l-2 border-hair pl-3 py-2 text-[12px] leading-[1.55] text-text3 ${className}`}
      {...props}
    />
  )
}

// --- hop tool-activity model ------------------------------------------------

export interface ToolActivityStep {
  tool: string
  state: ToolState
  detail?: string
}

const TOOL_COPY: Record<string, { icon: IconName; running: string; done: string }> = {
  web_search: { icon: 'search', running: 'Searching the web…', done: 'Searched the web' },
  get_weather: { icon: 'schedule', running: 'Checking the weather…', done: 'Checked the weather' },
  price_trip: { icon: 'credit_card', running: 'Pricing with your points…', done: 'Priced with your points' },
  save_profile_fact: { icon: 'loyalty', running: 'Remembering that…', done: 'Saved to your profile' },
}

const TOOL_COPY_NEUTRAL: Record<string, { running: string; done: string }> = {
  price_trip: { running: 'Pricing this route…', done: 'Priced this route' },
}

function humanize(tool: string): string {
  return tool.replace(/_/g, ' ')
}

export function toolTitle(step: ToolActivityStep, hasBalances = false): string {
  const running = step.state === 'input-streaming' || step.state === 'input-available'
  if (!hasBalances) {
    const neutral = TOOL_COPY_NEUTRAL[step.tool]
    if (neutral) return running ? neutral.running : neutral.done
  }
  const copy = TOOL_COPY[step.tool]
  if (copy) return running ? copy.running : copy.done
  return running ? `Working: ${humanize(step.tool)}…` : `Used ${humanize(step.tool)}`
}

export function toolIcon(step: ToolActivityStep): IconName {
  return TOOL_COPY[step.tool]?.icon ?? 'lightbulb'
}

export function shortDetail(detail: string): string {
  return detail
    .replace(/^(pricing|searching|checking|saving|remembering)\s+/i, '')
    .replace(/\s+against your points$/i, '')
    .replace(/\s+with your points$/i, '')
    .replace(/\s+against cash$/i, '')
    .trim()
}

// When there is detail content, renders as a collapsible <details>.
// When there is none, renders as a plain non-interactive row so the expand
// affordance isn't a dead control.
export function ToolActivity({
  step,
  children,
  hasBalances = false,
}: {
  step: ToolActivityStep
  children?: ReactNode
  hasBalances?: boolean
}) {
  const hasDetail = !!step.detail || !!children
  const suffix = step.detail ? shortDetail(step.detail) : ''
  const title = suffix ? `${toolTitle(step, hasBalances)} · ${suffix}` : toolTitle(step, hasBalances)
  const icon = toolIcon(step)
  const running = step.state === 'input-streaming' || step.state === 'input-available'
  const errored = step.state === 'output-error'

  if (!hasDetail) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-text3">
        <Icon
          name={icon}
          size={13}
          className={running ? 'text-brand hop-pulse' : errored ? 'text-warn' : 'text-text3'}
        />
        <span className="flex-1 truncate text-[12px] font-medium leading-none">{title}</span>
        <span className="ml-auto inline-flex shrink-0 items-center">
          {running ? (
            <Loader size={11} className="text-brand" />
          ) : errored ? (
            <Icon name="error" size={12} className="text-warn" />
          ) : (
            <Icon name="check_circle" size={12} className="text-brand/50" />
          )}
        </span>
      </div>
    )
  }

  return (
    <Tool>
      <ToolHeader title={title} icon={icon} state={step.state} />
      <ToolContent>
        {step.detail ? <p>{step.detail}</p> : null}
        {children}
      </ToolContent>
    </Tool>
  )
}

export default Tool
