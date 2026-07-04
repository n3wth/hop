'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export interface AccountUser {
  initial: string
  name?: string
  email?: string
  picture?: string
}

// Avatar that opens a small account menu: name/email, Profile, Log out.
// Picture resolution chain: stored profile picture (Google OAuth) → Gravatar
// looked up by the account email (d=404 so a missing Gravatar errors instead of
// serving a generic placeholder) → the initial. Email/password and passkey
// sign-ins have no OAuth picture, so Gravatar is their only image source.
export default function AccountMenu({ user }: { user: AccountUser }) {
  const [open, setOpen] = useState(false)
  // Index into the source chain; bumped by onError so a dead URL falls through
  // to the next source, ending at the initial.
  const [srcIdx, setSrcIdx] = useState(0)
  const [gravatar, setGravatar] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user.email || typeof crypto?.subtle?.digest !== 'function') return
    let cancelled = false
    const email = user.email.trim().toLowerCase()
    void crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(email))
      .then((buf) => {
        if (cancelled) return
        const hex = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        setGravatar(`https://gravatar.com/avatar/${hex}?s=160&d=404`)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user.email])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title="Account"
        className="grid h-10 w-10 cursor-pointer place-items-center overflow-hidden rounded-full bg-brand font-display text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep"
      >
        {(() => {
          const sources = [user.picture, gravatar].filter(
            (s): s is string => typeof s === 'string' && s.length > 0,
          )
          const src = sources[srcIdx]
          return src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setSrcIdx((i) => i + 1)}
            />
          ) : (
            user.initial
          )
        })()}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-60 overflow-hidden rounded-[14px] border border-border bg-surface"
        >
          <div className="border-b border-hair px-4 py-3">
            <div className="truncate text-[14px] font-semibold text-text">
              {user.name ?? 'Signed in'}
            </div>
            {user.email && user.email !== user.name ? (
              <div className="mt-[2px] truncate text-[12.5px] text-text3">{user.email}</div>
            ) : null}
          </div>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-[11px] text-[14px] font-medium text-text2 transition-colors hover:bg-sunk hover:text-text"
          >
            Programs
          </Link>
          {/* Deep links to the power features so they're reachable without
              scrolling the whole /account page (each is an anchor there). */}
          <Link
            href="/account#watches"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-[11px] text-[14px] font-medium text-text2 transition-colors hover:bg-sunk hover:text-text"
          >
            Standing orders
          </Link>
          <Link
            href="/account#whatif"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-[11px] text-[14px] font-medium text-text2 transition-colors hover:bg-sunk hover:text-text"
          >
            What if…
          </Link>
          <Link
            href="/account#trips"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-[11px] text-[14px] font-medium text-text2 transition-colors hover:bg-sunk hover:text-text"
          >
            Trips
          </Link>
          <a
            href="/auth/logout"
            role="menuitem"
            className="block border-t border-hair px-4 py-[11px] text-[14px] font-medium text-text2 transition-colors hover:bg-sunk hover:text-text"
          >
            Log out
          </a>
        </div>
      ) : null}
    </div>
  )
}
