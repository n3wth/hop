'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import Icon from '@/components/Icon'

// Search-route error boundary. assembleSearch is built to never throw (failures
// degrade per-section), so this catches the rarer surrounding failures — session,
// balance resolution, or render — and shows a calm, branded screen instead of a
// stack trace. `unstable_retry` re-runs the search segment; `reset` is the stable
// fallback. No raw error.message in the UI.
export default function SearchError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset?: () => void
  unstable_retry?: () => void
}) {
  useEffect(() => {
    // Surface to the console for debugging; users never see the trace.
    console.error(error)
  }, [error])

  const retry = unstable_retry ?? reset ?? (() => {})

  return (
    <div className="mx-auto flex min-h-[calc(100vh-var(--hop-nav))] max-w-[var(--container-full)] flex-col items-center justify-center px-4 text-center sm:px-8 lg:px-16">
      <div className="hop-rise grid place-items-center" style={{ ['--hop-delay' as string]: '40ms' }}>
        <Link href="/" aria-label="hop — home" className="grid place-items-center">
          <Logo size={92} carve="var(--color-bg)" className="text-brand" decorative />
        </Link>
      </div>

      <h1
        className="hop-rise mt-7 font-display text-[34px] font-semibold tracking-[-0.02em] text-text"
        style={{ ['--hop-delay' as string]: '100ms' }}
      >
        That search didn&apos;t come through.
      </h1>

      <p
        className="hop-rise mt-3 max-w-[44ch] text-[16px] leading-[1.55] text-text2"
        style={{ ['--hop-delay' as string]: '160ms' }}
      >
        Something broke while pricing this trip. It&apos;s usually temporary —
        run it again, or start a new search.
      </p>

      <div className="hop-rise mt-8 flex flex-wrap items-center justify-center gap-3" style={{ ['--hop-delay' as string]: '220ms' }}>
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex items-center gap-[9px] rounded-[14px] bg-brand px-7 py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          <Icon name="swap_horiz" size={18} />
          Try again
        </button>
        <Link
          href="/search"
          className="inline-flex items-center gap-[9px] rounded-[14px] border border-border bg-surface px-7 py-[15px] text-[15px] font-semibold text-text transition-colors hover:bg-sunk"
        >
          <Icon name="search" size={18} />
          New search
        </Link>
        <Link
          href="/"
          className="inline-flex items-center rounded-[14px] border border-border bg-surface px-7 py-[15px] text-[15px] font-semibold text-text transition-colors hover:bg-sunk"
        >
          Go home
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-6 text-[12px] tracking-[0.04em] text-text3">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  )
}
