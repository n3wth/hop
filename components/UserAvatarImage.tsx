'use client'

import { useEffect, useState } from 'react'

export interface UserAvatarImageProps {
  picture?: string
  email?: string
  initial: string
}

// The ONE avatar source chain, shared by every surface that draws the user
// (TopNav's AccountMenu, the /account hero, the admin rail): stored profile
// picture (Google OAuth) → Gravatar looked up by the account email (d=404 so
// a missing Gravatar errors instead of serving a stock placeholder) → the
// initial. Renders only the content — the caller owns the circular container,
// colors, and type size, so each surface keeps its own chrome.
export default function UserAvatarImage({ picture, email, initial }: UserAvatarImageProps) {
  // Index into the source chain; bumped by onError so a dead URL falls through
  // to the next source, ending at the initial.
  const [srcIdx, setSrcIdx] = useState(0)
  const [gravatar, setGravatar] = useState<string | null>(null)

  useEffect(() => {
    if (!email || typeof crypto?.subtle?.digest !== 'function') return
    let cancelled = false
    const normalized = email.trim().toLowerCase()
    void crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(normalized))
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
  }, [email])

  const sources = [picture, gravatar].filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  )
  // De-dupe: toNavUser may already supply the same Gravatar URL as `picture`.
  const chain = [...new Set(sources)]
  const src = chain[srcIdx]

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
    <>{initial}</>
  )
}
