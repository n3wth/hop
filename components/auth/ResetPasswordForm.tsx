'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { Input } from '@/components/ui/Field'

const inputClass =
  'w-full rounded-[10px] border border-border bg-paper px-3.5 py-2.5 text-[13.5px] font-semibold text-text outline-none transition-colors focus:border-brand'

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await authClient.resetPassword({ newPassword: password, token })
      if (res?.error) {
        setError('That reset link didn’t work. Request a new one.')
        setPending(false)
        return
      }
      setDone(true)
    } catch {
      setError('That reset link didn’t work. Request a new one.')
    }
    setPending(false)
  }

  if (!token) {
    return (
      <p className="rounded-[12px] border border-weak/40 bg-weak/10 px-4 py-3 text-center text-[13.5px] leading-[1.5] text-text">
        This reset link is missing its token.{' '}
        <Link href="/forgot-password" className="underline-offset-2 hover:underline">
          Request a new one
        </Link>
        .
      </p>
    )
  }

  if (done) {
    return (
      <p className="rounded-[12px] border border-hair bg-sunk px-4 py-3 text-center text-[13.5px] leading-[1.5] text-text2">
        Password reset.{' '}
        <Link href="/login" className="text-text underline-offset-2 hover:underline">
          Sign in
        </Link>
        .
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
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-[12px] border border-weak/40 bg-weak/10 px-4 py-3 text-[13.5px] leading-[1.5] text-text"
        >
          {error}
        </div>
      ) : null}
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        aria-label="New password"
        autoComplete="new-password"
        required
        minLength={8}
        className="font-semibold"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-brand px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Resetting…' : 'Reset password'}
      </button>
    </form>
  )
}
