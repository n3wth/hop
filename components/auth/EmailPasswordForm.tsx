'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

const inputClass =
  'w-full rounded-[10px] border border-border bg-paper px-3.5 py-2.5 text-[13.5px] font-semibold text-text outline-none transition-colors focus:border-brand'

// Email/password sign-in and sign-up, one component toggled by mode (fields are
// identical — only the submit action + confirmation copy differ). Because
// lib/auth.ts sets requireEmailVerification: true, a successful sign-up does
// NOT sign the user in — it renders a "check your email" confirmation instead
// of redirecting, same as Better Auth's own contract.
export default function EmailPasswordForm({
  callbackURL,
  enabled,
}: {
  callbackURL: string
  enabled: boolean
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedUp, setSignedUp] = useState(false)
  const [needsVerify, setNeedsVerify] = useState(false)
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // Re-request the verification email for the address in the form. Uses Better
  // Auth's own /send-verification-email endpoint (same server callback that
  // fired at sign-up), so it degrades exactly like sign-up does when email
  // isn't configured.
  async function resendVerification() {
    if (!email || resend === 'sending') return
    setResend('sending')
    try {
      const res = await authClient.sendVerificationEmail({ email, callbackURL })
      setResend(res?.error ? 'error' : 'sent')
    } catch {
      setResend('error')
    }
  }

  function resendControl() {
    if (resend === 'sent')
      return <span className="mt-2 block text-[12.5px] text-text2">Sent — check your inbox.</span>
    return (
      <span className="mt-2 block text-[12.5px]">
        {resend === 'error' ? (
          <span className="mr-2 text-text2">Couldn&rsquo;t send.</span>
        ) : null}
        <button
          type="button"
          onClick={resendVerification}
          disabled={resend === 'sending'}
          className="font-semibold text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resend === 'sending' ? 'Sending…' : 'Resend verification email'}
        </button>
      </span>
    )
  }

  async function submit() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      if (mode === 'signup') {
        const name = email.split('@')[0] || email
        const res = await authClient.signUp.email({ email, password, name })
        if (res?.error) {
          setError(
            res.error.message?.toLowerCase().includes('exist')
              ? 'An account already exists for that email.'
              : 'Sign-up didn’t go through. Try again.',
          )
          setPending(false)
          return
        }
        setSignedUp(true)
        setPending(false)
        return
      }
      const res = await authClient.signIn.email({ email, password, callbackURL })
      if (res?.error) {
        const code = res.error.code ?? ''
        const unverified = code === 'EMAIL_NOT_VERIFIED'
        setNeedsVerify(unverified)
        setResend('idle')
        setError(
          unverified
            ? 'Verify your email first — check your inbox.'
            : 'Sign-in didn’t go through. Try again.',
        )
        setPending(false)
      }
      // On success Better Auth navigates to callbackURL — no state to reset.
    } catch {
      setError('Sign-in didn’t go through. Try again.')
      setPending(false)
    }
  }

  if (!enabled) {
    return (
      <p className="rounded-[12px] border border-hair bg-sunk px-4 py-3 text-center text-[13.5px] leading-[1.5] text-text2">
        Email sign-in isn’t configured in this environment.
      </p>
    )
  }

  if (signedUp) {
    return (
      <div className="rounded-[12px] border border-hair bg-sunk px-4 py-3 text-center text-[13.5px] leading-[1.5] text-text2">
        Check your email to verify your account.
        {resendControl()}
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-[12px] border border-weak/40 bg-weak/10 px-4 py-3 text-[13.5px] leading-[1.5] text-text"
        >
          {error}
          {needsVerify ? resendControl() : null}
        </div>
      ) : null}

      <div className="space-y-3">
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
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={8}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-brand px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? mode === 'signup'
            ? 'Creating account…'
            : 'Signing in…'
          : mode === 'signup'
            ? 'Create account'
            : 'Sign in'}
      </button>

      <div className="mt-4 flex items-center justify-between text-[12.5px] text-text3">
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
          }}
          className="underline-offset-2 transition-colors hover:text-text hover:underline"
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
        {mode === 'signin' ? (
          <Link href="/forgot-password" className="underline-offset-2 transition-colors hover:text-text hover:underline">
            Forgot password?
          </Link>
        ) : null}
      </div>
    </form>
  )
}
