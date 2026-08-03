'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Input } from '@/components/ui/Field'
import { setAccountPassword } from '@/app/account/security-actions'

const inputClass =
  'no-inner-ring w-full rounded-[10px] border border-border bg-paper px-3.5 py-2.5 text-[13.5px] font-semibold text-text outline-none transition-colors focus:border-brand'

// Two distinct code paths behind one component, gated on whether the user
// already has a password (server-fetched hasPassword prop) — NOT one shared
// flow. First-time set (Google-only user) goes through the server-only
// auth.api.setPassword action; changing an existing password goes through
// authClient.changePassword (needs the current password). Because a password
// set this way belongs to a user whose emailVerified is already true (set at
// Google signup), this path never triggers the email-verification gate.
export default function SecurityPassword({
  enabled,
  hasPassword,
}: {
  enabled: boolean
  hasPassword: boolean
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      if (hasPassword) {
        const res = await authClient.changePassword({ newPassword, currentPassword })
        if (res?.error) {
          setError('Couldn’t update your password. Check your current password and try again.')
          setPending(false)
          return
        }
      } else {
        const res = await setAccountPassword(newPassword)
        if (!res.ok) {
          setError('Couldn’t set a password. Try again.')
          setPending(false)
          return
        }
      }
      setDone(true)
      setCurrentPassword('')
      setNewPassword('')
    } catch {
      setError('Couldn’t update your password. Try again.')
    }
    setPending(false)
  }

  if (!enabled) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-surface px-5 py-4">
        <h3 className="font-display text-[15px] font-semibold text-text">Password</h3>
        <p className="mt-1 text-[13px] text-text2">Password sign-in isn’t configured in this environment.</p>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius)] border border-border bg-surface px-5 py-4">
      <h3 className="font-display text-[15px] font-semibold text-text">Password</h3>
      <p className="mt-1 text-[13px] text-text2">
        {hasPassword
          ? 'Change the password you use to sign in without Google.'
          : 'Set a password so you can sign in without Google.'}
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-[12px] border border-weak/40 bg-weak/10 px-4 py-3 text-[13px] leading-[1.5] text-text"
        >
          {error}
        </div>
      ) : null}
      {done ? (
        <p className="mt-3 text-[13px] font-medium text-brand-deep">
          {hasPassword ? 'Password updated.' : 'Password set — you can now sign in with email + password.'}
        </p>
      ) : null}

      <form
        className="mt-3 space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {hasPassword ? (
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            aria-label="Current password"
            autoComplete="current-password"
            required
            className="font-semibold"
          />
        ) : null}
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={hasPassword ? 'New password' : 'Password'}
          aria-label={hasPassword ? 'New password' : 'Password'}
          autoComplete="new-password"
          required
          minLength={8}
          className="font-semibold"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-paper px-5 py-2.5 text-[13.5px] font-semibold text-text transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Saving…' : hasPassword ? 'Update password' : 'Set password'}
        </button>
      </form>
    </div>
  )
}
