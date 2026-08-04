'use client'

import { useEffect, useRef, useState } from 'react'
import { authClient } from '@/lib/auth-client'

export interface PasskeyInfo {
  id: string
  name?: string | null
  createdAt: string | Date | null
  deviceType: string
  aaguid?: string | null
}

// Registration (authClient.passkey.addPasskey — needs an existing session) is
// a DIFFERENT Better Auth call from login's authentication
// (authClient.signIn.passkey — no session yet, see PasskeyButton.tsx). Don't
// conflate them into one component.
export default function SecurityPasskeys({
  enabled,
  passkeys: initialPasskeys,
}: {
  enabled: boolean
  passkeys: PasskeyInfo[]
}) {
  const [passkeys, setPasskeys] = useState(initialPasskeys)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [armedId, setArmedId] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function arm(id: string) {
    setArmedId(id)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setArmedId(null), 4000)
  }

  async function add() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await authClient.passkey.addPasskey()
      if (res?.error) {
        setError('Couldn’t add a passkey. Try again.')
      } else {
        const { data } = await authClient.passkey.listUserPasskeys()
        if (data) setPasskeys(data as PasskeyInfo[])
      }
    } catch {
      setError('Couldn’t add a passkey. Try again.')
    }
    setPending(false)
  }

  async function remove(id: string) {
    setArmedId(null)
    setPending(true)
    setError(null)
    try {
      const res = await authClient.passkey.deletePasskey({ id })
      if (res?.error) {
        setError('Couldn’t remove that passkey. Try again.')
      } else {
        setPasskeys((list) => list.filter((p) => p.id !== id))
      }
    } catch {
      setError('Couldn’t remove that passkey. Try again.')
    }
    setPending(false)
  }

  if (!enabled) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-surface px-5 py-4">
        <h3 className="font-display text-[15px] font-semibold text-text">Passkeys</h3>
        <p className="mt-1 text-[13px] text-text2">Passkey sign-in isn’t configured in this environment.</p>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius)] border border-border bg-surface px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-semibold text-text">Passkeys</h3>
          <p className="mt-1 text-[13px] text-text2">Sign in on this device with Face ID, Touch ID, or a security key.</p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-[10px] border border-border bg-paper px-3.5 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Waiting…' : 'Add a passkey'}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-[12px] border border-weak/40 bg-weak/10 px-4 py-3 text-[13px] leading-[1.5] text-text"
        >
          {error}
        </div>
      ) : null}

      {passkeys.length > 0 ? (
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-text">
                  {p.name || 'Passkey'}
                </div>
                <div className="text-[12px] text-text2">
                  {p.createdAt ? `Added ${new Date(p.createdAt).toLocaleDateString('en-US')}` : 'Added recently'}
                </div>
              </div>
              {armedId === p.id ? (
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={pending}
                    className="inline-flex items-center rounded-[10px] border border-weak px-3 py-1.5 text-[12.5px] font-semibold text-weak transition-colors disabled:opacity-60"
                  >
                    Confirm?
                  </button>
                  <button
                    type="button"
                    onClick={() => setArmedId(null)}
                    className="inline-flex items-center rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-text"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => arm(p.id)}
                  disabled={pending}
                  className="inline-flex flex-shrink-0 items-center rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-weak disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-text2">No passkeys yet.</p>
      )}
    </div>
  )
}
