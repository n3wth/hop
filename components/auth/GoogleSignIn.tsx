'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

// Official Google "G" — provider-branded sign-in buttons read as trustworthy.
// Static four-color mark per Google's identity guidelines (light button).
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 18 18" width={size} height={size} aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
      />
    </svg>
  )
}

// The /login action. Better Auth's social sign-in is a POST (client SDK) that
// answers with the Google authorization URL — a plain anchor can't start it,
// so this is a client component by necessity. One button, one door: the same
// flow signs in and creates the account.
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

      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-3 rounded-[var(--radius)] border border-border bg-surface px-6 py-3.5 text-[15px] font-semibold text-text transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleG />
        {pending ? 'Opening Google…' : 'Continue with Google'}
      </button>

      <p className="mt-4 text-center text-[12.5px] leading-[1.6] text-text3">
        New to hop? The same button creates your account.
      </p>
    </div>
  )
}
