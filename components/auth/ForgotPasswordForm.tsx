'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

const inputClass =
  'no-inner-ring w-full rounded-[10px] border border-border bg-paper px-3.5 py-2.5 text-[13.5px] font-semibold text-text outline-none transition-colors focus:border-brand'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit() {
    if (pending) return
    setPending(true)
    try {
      await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })
    } catch {
      // fall through to the same confirmation regardless — see note below
    }
    // Deliberately non-revealing of account existence either way.
    setSent(true)
    setPending(false)
  }

  if (sent) {
    return (
      <p className="rounded-[12px] border border-hair bg-sunk px-4 py-3 text-center text-[13.5px] leading-[1.5] text-text2">
        If that email has an account, we sent a reset link.
      </p>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        aria-label="Email"
        autoComplete="email"
        required
        className={inputClass}
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-brand px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  )
}
