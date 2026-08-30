import Link from 'next/link'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'

// Branded 404 for a missing/revoked/flag-off receipt — the ONE place outside
// the logo where the bunny gets a warm, first-person line (copy-spec's bunny
// budget). Same composition as app/not-found.tsx, different copy.
export default function ReceiptNotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-var(--hop-nav))] max-w-[var(--container-full)] flex-col items-center justify-center px-4 text-center sm:px-8 lg:px-16">
      <div className="hop-rise grid place-items-center" style={{ ['--hop-delay' as string]: '40ms' }}>
        <Link href="/" aria-label="hop — home" className="grid place-items-center">
          <Logo size={92} className="text-brand" decorative />
        </Link>
      </div>

      <h1
        className="hop-rise mt-7 text-balance font-display text-[34px] font-semibold tracking-[-0.02em] text-text"
        style={{ ['--hop-delay' as string]: '100ms' }}
      >
        This link has hopped away.
      </h1>

      <p
        className="hop-rise mt-3 max-w-[44ch] text-[16px] leading-[1.55] text-text2"
        style={{ ['--hop-delay' as string]: '160ms' }}
      >
        This receipt doesn&apos;t exist anymore, or never did. Run a search to get your own verdict.
      </p>

      <div className="hop-rise mt-8 flex items-center gap-3" style={{ ['--hop-delay' as string]: '220ms' }}>
        <Button href="/search">Search flights</Button>
        <Button href="/" variant="secondary">
          Back to hop
        </Button>
      </div>
    </div>
  )
}
