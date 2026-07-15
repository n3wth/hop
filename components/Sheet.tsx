'use client'

// Sheet — a bottom-sheet built on Astryx's Dialog (native <dialog>-backed
// modal). Used on /ask to keep secondary affordances (e.g. "Have hop book
// it") ON the single concierge surface instead of parked below the fold: the
// control rail opens this sheet, the request stays reachable, and the page
// keeps its one scroll region.
//
// Previously ~176 lines of hand-rolled portal + focus-trap + scroll-lock +
// Escape handling (see git history); Dialog's native <dialog>/showModal()
// gives all of that for free — portal-to-top-layer, native focus trap,
// Escape-to-close, scroll lock (Astryx's useScrollLock) — so this file is
// now just Sheet's own prop API plus hop's exact bottom-sheet header/panel
// markup, reusing Dialog only for the modal *mechanics* (see the `style`
// override below for why the panel is pinned to the floor via raw inline
// styles rather than Dialog's own `position`/`width` props). The header is
// hand-rolled rather than Astryx's DialogHeader so the close button stays
// pixel-identical to hop's existing circular icon button — DialogHeader
// renders an Astryx Button there, which follows Astryx's own (differently
// shaped) icon-button styling.
//
// Flat editorial: a bg-paper panel on a soft scrim, no shadow/gradient/glow
// — Dialog's own elevation shadow is nulled globally by the theme's flat-law
// token overrides (lib/astryx-theme.ts).
//
// Prop API is unchanged from the hand-rolled version, so call sites
// (app/ask/*) don't change.

import { useId, type ReactNode } from 'react'
import { Dialog } from '@astryxdesign/core/Dialog'
import Icon from './Icon'

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
  const titleId = useId()

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      // purpose="info" keeps the original behavior: Escape AND backdrop
      // click both close the sheet.
      purpose="info"
      // Anchored to the floor, full width — turns the centered dialog into
      // a bottom sheet. maxHeight matches the old max-h-[85dvh] cap.
      //
      // Dialog's `position`/`width` props alone were not reliable here: the
      // native <dialog> UA stylesheet sets `inset: 0` + `margin: auto` (how
      // browsers auto-center a modal), and even with `position={{bottom:0}}`
      // the panel kept docking to the *top* of the viewport instead of the
      // floor. Setting every inset side directly in `style` (inline styles
      // beat both the UA stylesheet and Dialog's own custom-property-driven
      // atomic classes, full stop — no cascade ambiguity) is what actually
      // pins it to the bottom edge.
      maxHeight="85dvh"
      padding={0}
      aria-labelledby={titleId}
      // Square bottom corners (flush with the viewport edge) + a hairline
      // top border — Dialog has no border by default and rounds all four
      // corners uniformly, neither of which matches a floor-anchored sheet.
      style={{
        top: 'auto',
        right: 0,
        bottom: 0,
        left: 0,
        width: 'auto',
        margin: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderTop: '1px solid var(--color-border)',
      }}
      className="overflow-y-auto"
    >
      <div className="mx-auto w-full max-w-[640px] px-4 py-5 sm:px-6">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-[17px] font-semibold text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-text3 transition-colors hover:bg-sunk hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </Dialog>
  )
}
