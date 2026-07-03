'use client'

import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react'

export type SuggestionsProps = ComponentProps<'div'>

// Single-line, centered row — chips beyond what fits on one line are hidden
// rather than wrapped to a second row (a wrapped second line reads as messy,
// especially centered). "How many fit" depends on viewport width AND each
// chip's own text length (starter chips are static; model-authored follow-up
// chips are dynamic), so this is measured with ResizeObserver rather than
// solved with CSS alone. useLayoutEffect (not useEffect) so the trim happens
// before paint — no flash of the full wrapped set.
export function Suggestions({ className = '', children, ...props }: SuggestionsProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  // Start by showing everything (matches SSR output — no layout shift for
  // crawlers/no-JS); useLayoutEffect trims to what fits before the browser
  // paints, so on a real browser this never visibly flashes the full set.
  const [visibleCount, setVisibleCount] = useState<number | null>(null)
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean)

  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const measure = () => {
      const kids = Array.from(row.children) as HTMLElement[]
      const available = row.clientWidth
      const gap = 6
      let used = 0
      let count = 0
      for (const kid of kids) {
        used += kid.offsetWidth + (count > 0 ? gap : 0)
        if (used > available) break
        count++
      }
      setVisibleCount(count)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(row)
    return () => ro.disconnect()
  }, [items.length])

  const visible = visibleCount == null ? items : items.slice(0, visibleCount)

  return (
    <div className={className} {...props}>
      <div ref={rowRef} className="flex flex-nowrap items-center justify-center gap-1.5 overflow-hidden">
        {visible}
      </div>
    </div>
  )
}

export type SuggestionProps = Omit<ComponentProps<'button'>, 'onClick'> & {
  suggestion: string
  onClick?: (suggestion: string) => void
}

export function Suggestion({
  suggestion,
  onClick,
  className = '',
  children,
  ...props
}: SuggestionProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(suggestion)}
      className={`flex-shrink-0 rounded-full border border-border bg-paper px-3.5 py-1.5 text-[13px] font-medium text-text2 transition-colors hover:border-brand hover:text-brand disabled:pointer-events-none disabled:border-border-soft disabled:text-text3 ${className}`}
      {...props}
    >
      {children || suggestion}
    </button>
  )
}

export default Suggestion
