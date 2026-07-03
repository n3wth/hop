'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import Icon from '@/components/Icon'

// Login-page AUTHENTICATION only (authClient.signIn.passkey) — distinct from
// the account-page REGISTRATION flow (authClient.passkey.addPasskey), which
// needs an existing session and lives in components/auth/SecurityPasskeys.tsx.
// Nobody has a passkey at launch (registration only happens from /account
// after a user already has some other identity), so this only ever helps a
// returning user on this exact device — kept visually lighter than the two
// account-creation paths above it.
export default function PasskeyButton({
  callbackURL,
  enabled,
}: {
  callbackURL: string
  enabled: boolean
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await authClient.signIn.passkey()
      if (res?.error) {
        setError('Sign-in didn’t go through. Try again.')
      } else if (res?.data) {
        window.location.assign(callbackURL)
      }
      setPending(false)
    } catch {
      setError('Sign-in didn’t go through. Try again.')
      setPending(false)
    }
  }

  if (!enabled) {
    return (
      <p className="rounded-[12px] border border-hair bg-sunk px-4 py-3 text-center text-[13.5px] leading-[1.5] text-text2">
        Passkey sign-in isn’t configured in this environment.
      </p>
    )
  }

  return (
    <div>
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-[12px] border border-weak/40 bg-weak/10 px-4 py-3 text-[13.5px] leading-[1.5] text-text"
        >
          {error}
        </div>
      ) : null}
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-3 rounded-[var(--radius)] border border-border bg-surface px-6 py-3.5 text-[15px] font-semibold text-text transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name="shield" size={20} />
        {pending ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
      </button>
    </div>
  )
}
