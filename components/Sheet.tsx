'use client'

// Sheet — a minimal, native slide-up bottom sheet.
//
// Used on /ask to keep secondary affordances (e.g. "Have hop book it") ON the
// single concierge surface instead of parked below the fold: the control rail
// opens this sheet, the request stays reachable, and the page keeps its one
// scroll region. Flat editorial: a bg-paper panel on a soft scrim, no shadow/
// gradient/glow. The only motion is a transform-only slide-up (backdrop fades),
// which is inert under prefers-reduced-motion (motion-reduce:transition-none).
//
// Accessibility: role="dialog" aria-modal, labelled by the title; focus is moved
// INTO the sheet on open and RESTORED to the trigger on close; Tab is trapped
// within the panel; Escape closes; and body scroll is locked while open. Rendered
// through a portal to document.body so the fixed overlay is viewport-anchored and
// never clipped by a transformed/overflow ancestor.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

// Tabbable elements inside the panel — the focus trap cycles across these.
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface SheetProps {
  /** Controlled open state (the trigger lives in the parent). */
  open: boolean
  /** Close request — from the backdrop, the close button, or Escape. */
  onClose: () => void
  /** Accessible dialog title, rendered in the sheet header. */
  title: string
  children: ReactNode
}

export default function Sheet({ open, onClose, title, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Restore focus here when the sheet closes (the element that had it on open).
  const previousActive = useRef<HTMLElement | null>(null)
  // Kept in a ref so the trap/scroll effect can stay keyed to `open` alone —
  // a fresh onClose each parent render must not re-run (and re-lock/re-focus) it.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const titleId = useId()

  // Slide/fade in on open: render off-screen for one frame, then flip to the
  // resting transform so the transition runs. Under reduced motion the class is
  // transition-none, so this simply snaps into place. Cleanup resets the flag so a
  // reopen slides again rather than appearing already-docked.
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => setEntered(true))
    return () => {
      cancelAnimationFrame(id)
      setEntered(false)
    }
  }, [open])

  // Focus trap + scroll lock + focus restore, live only while open.
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    previousActive.current = (document.activeElement as HTMLElement | null) ?? null

    // Lock body scroll behind the sheet.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusables = () =>
      panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.tabIndex !== -1 && el.offsetParent !== null,
          )
        : []

    // Move focus into the sheet (first control, else the panel itself).
    ;(focusables()[0] ?? panel)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        panel?.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      // Focus parked OUTSIDE the cycle (the tabIndex=-1 panel after a click on
      // non-interactive content, or anything beyond the scrim) re-enters the
      // trap instead of tabbing into the obscured page behind the sheet.
      if (!active || !items.includes(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
        return
      }
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      // Restore focus to whatever opened the sheet.
      previousActive.current?.focus?.()
    }
  }, [open])

  const close = useCallback(() => onCloseRef.current(), [])

  // `open` starts false, so the first (SSR + hydration) render returns null on
  // both server and client; the portal only mounts after a client interaction,
  // by which point document.body exists.
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      {/* scrim — click to close. tabIndex -1 keeps it out of the focus cycle. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
        className={`absolute inset-0 h-full w-full cursor-default bg-black/30 transition-opacity duration-200 motion-reduce:transition-none ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* panel — slides up from the floor (transform only). */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative max-h-[85dvh] w-full overflow-y-auto rounded-t-[var(--radius-lg)] border-t border-border bg-paper outline-none transition-transform duration-300 ease-[var(--ease-premium)] motion-reduce:transition-none ${
          entered ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto w-full max-w-[640px] px-4 py-5 sm:px-6">
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-display text-[17px] font-semibold text-text">
              {title}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-text3 transition-colors hover:bg-sunk hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Icon name="close" size={17} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
