'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import UserAvatarImage from './UserAvatarImage'

export interface AccountUser {
  initial: string
  name?: string
  email?: string
  picture?: string
}

// Avatar that opens a small account menu: name/email, Profile, Log out.
// The picture chain (picture → Gravatar → initial) lives in UserAvatarImage,
// shared with the /account hero and the admin rail so every surface resolves
// the same face the same way.
export default function AccountMenu({ user }: { user: AccountUser }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
        <UserAvatarImage picture={user.picture} email={user.email} initial={user.initial} />
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
