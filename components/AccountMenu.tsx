'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
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
//
// Built on Astryx's DropdownMenu for the interaction mechanics — outside-click
// dismiss, Escape, roving-focus keyboard nav, and role="menu"/aria-haspopup/
// aria-expanded wiring (previously hand-rolled, ~50 fewer lines here) — but
// in *compound* mode (JSX children, not the `items` array): the menu rows
// stay real `next/link` elements (and a real `<a>` for the Auth0 logout
// redirect, which must be a genuine browser navigation — see ui/Button.tsx's
// `native` prop for the same convention), not Astryx's onClick-only
// DropdownMenuItem, so right-click/Cmd-click "open in new tab" still works.
// DropdownMenu's keyboard roving finds them the same way either way — it
// queries the DOM for `[role="menuitem"]`, not by component type.
//
// The trigger's circular photo-avatar button is a one-off shape none of
// Astryx's stock Button variants cover, themed via a custom 'avatar' variant
// in lib/astryx-theme.ts.
export default function AccountMenu({ user }: { user: AccountUser }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const itemClass =
    'block px-4 py-[11px] text-[14px] font-medium text-text2 transition-colors hover:bg-sunk hover:text-text'

  return (
    <DropdownMenu
      isMenuOpen={open}
      onOpenChange={setOpen}
      hasChevron={false}
      menuWidth={240}
      button={{
        label: 'Account menu',
        variant: 'avatar',
        tooltip: 'Account',
        children: (
          <span className="grid h-full w-full place-items-center overflow-hidden rounded-full font-display text-[15px] font-semibold">
            <UserAvatarImage picture={user.picture} email={user.email} initial={user.initial} />
          </span>
        ),
      }}
    >
      <div className="border-b border-hair px-4 py-3">
        <div className="truncate text-[14px] font-semibold text-text">
          {user.name ?? 'Signed in'}
        </div>
        {user.email && user.email !== user.name ? (
          <div className="mt-[2px] truncate text-[12.5px] text-text3">{user.email}</div>
        ) : null}
      </div>
      <Link href="/account" role="menuitem" tabIndex={-1} onClick={close} className={itemClass}>
        Programs
      </Link>
      {/* Deep links to the power features so they're reachable without
          scrolling the whole /account page (each is an anchor there). */}
      <Link href="/account#watches" role="menuitem" tabIndex={-1} onClick={close} className={itemClass}>
        Standing orders
      </Link>
      <Link href="/account#whatif" role="menuitem" tabIndex={-1} onClick={close} className={itemClass}>
        What if…
      </Link>
      <Link href="/account#trips" role="menuitem" tabIndex={-1} onClick={close} className={itemClass}>
        Trips
      </Link>
      <a href="/auth/logout" role="menuitem" tabIndex={-1} className={`border-t border-hair ${itemClass}`}>
        Log out
      </a>
    </DropdownMenu>
  )
}
