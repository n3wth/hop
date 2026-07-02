'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import Icon from '@/components/Icon'
import Button from '@/components/ui/Button'

// Route error boundary. Catches uncaught exceptions from the page's Server
// Component render (e.g. an upstream throwing) and shows a calm, branded screen
// instead of a stack trace. unstable_retry re-fetches and re-renders the segment;
// reset is the stable fallback. No raw error.message in the UI.
export default function Error({
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
        That didn&apos;t go to plan.
      </h1>

      <p
        className="hop-rise mt-3 max-w-[44ch] text-[16px] leading-[1.55] text-text2"
        style={{ ['--hop-delay' as string]: '160ms' }}
      >
        Something broke on our end. It&apos;s usually temporary — give it another go.
      </p>

      <div className="hop-rise mt-8 flex items-center gap-3" style={{ ['--hop-delay' as string]: '220ms' }}>
        <Button onClick={() => retry()}>
          <Icon name="refresh" size={16} />
          Try again
        </Button>
        <Button href="/" variant="secondary">
          Go home
        </Button>
      </div>

      {error.digest ? (
        <p className="mt-6 text-[12px] tracking-[0.04em] text-text3">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  )
}
