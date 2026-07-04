'use client'

import { useState, useTransition } from 'react'
import { deleteAccount } from '@/app/actions/accounts'

// Danger zone — the /privacy deletion promise, honored in-product. Two-step:
// the first click only reveals the confirm row (nothing destructive on one
// tap), the second runs the server action and sends the browser home (the
// session died with its rows). Flat editorial: hairline border, color only.
export default function DeleteAccount() {
  const [arming, setArming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function confirmDelete() {
    setError(null)
    startTransition(async () => {
      const res = await deleteAccount()
      if (res.ok) {
        window.location.href = '/'
        return
      }
      setError(res.error ?? "Couldn't delete — try again")
    })
  }

  return (
    <section id="delete-account" className="mt-6 scroll-mt-24">
      <div className="rounded-[var(--radius)] border border-border bg-surface px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
              Delete account
            </h2>
            <p className="mt-1 text-[13.5px] text-text2">
              Deletes your programs, watches, conversations, and sign-in. No undo.
            </p>
          </div>
          {!arming ? (
            <button
              type="button"
              onClick={() => setArming(true)}
              className="flex-shrink-0 rounded-[var(--radius-sm)] border-[1.5px] border-border px-4 py-2 text-[13.5px] font-semibold text-weak transition-colors hover:border-weak"
            >
              Delete account
            </button>
          ) : (
            <div className="flex flex-shrink-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setArming(false)}
                disabled={pending}
                className="rounded-[var(--radius-sm)] px-3 py-2 text-[13.5px] font-semibold text-text2 transition-colors hover:text-text"
              >
                Keep account
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={pending}
                className="rounded-[var(--radius-sm)] border-[1.5px] border-weak bg-weak-bg px-4 py-2 text-[13.5px] font-semibold text-weak transition-colors hover:bg-weak hover:text-white disabled:opacity-60"
              >
                {pending ? 'Deleting…' : 'Yes, delete everything'}
              </button>
            </div>
          )}
        </div>
        {error ? <p className="mt-2 text-[13px] font-medium text-weak">{error}</p> : null}
      </div>
    </section>
  )
}
