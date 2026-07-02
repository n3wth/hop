'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import Button from '@/components/ui/Button'

// The /login actions. Better Auth's social sign-in is a POST (client SDK) that
// answers with the Google authorization URL — a plain anchor can't start it,
// so this is a client component by necessity.
export default function GoogleSignIn({
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
      const res = await authClient.signIn.social({ provider: 'google', callbackURL })
      if (res?.error) {
        setError('Sign-in didn’t go through. Try again.')
        setPending(false)
      }
      // On success the SDK navigates to Google — no state to reset.
    } catch {
      setError('Sign-in didn’t go through. Try again.')
      setPending(false)
    }
  }

  if (!enabled) {
    return (
      <p className="rounded-[12px] border border-hair bg-sunk px-4 py-3 text-center text-[13.5px] leading-[1.5] text-text2">
        Sign-in isn’t configured in this environment.
      </p>
    )
  }

  return (
    <div>
      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-[12px] border border-weak/40 bg-weak/10 px-4 py-3 text-[13.5px] leading-[1.5] text-text"
        >
          {error}
        </div>
      ) : null}

      <Button onClick={start} disabled={pending} fullWidth>
        {pending ? 'Opening Google…' : 'Continue with Google'}
      </Button>

      <div className="my-5 flex items-center gap-3 text-[12px] text-text3">
        <span className="h-px flex-1 bg-hair" aria-hidden />
        or
        <span className="h-px flex-1 bg-hair" aria-hidden />
      </div>

      <Button onClick={start} disabled={pending} variant="secondary" fullWidth>
        Create account with Google
      </Button>
    </div>
  )
}
