'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export interface AccountUser {
  initial: string
  name?: string
  email?: string
  picture?: string
}

// Avatar that opens a small account menu: name/email, Profile, Log out.
// Loads the Auth0 picture when present, falls back to the initial.
export default function AccountMenu({ user }: { user: AccountUser }) {
  const [open, setOpen] = useState(false)
  const [imgOk, setImgOk] = useState(true)
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
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-1 pr-2 transition-colors hover:bg-sunk"
      >
        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-brand font-display text-[14px] font-bold text-white sm:h-9 sm:w-9 sm:text-[15px]">
          {user.picture && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.picture}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setImgOk(false)}
            />
          ) : (
            user.initial
          )}
        </span>
        <span
          className="text-text3 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <Icon name="expand_more" size={18} />
        </span>
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
          <a
            href="/account"
            role="menuitem"
            className="block px-4 py-[11px] text-[14px] font-medium text-text2 transition-colors hover:bg-sunk hover:text-text"
          >
            Profile &amp; trips
          </a>
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
