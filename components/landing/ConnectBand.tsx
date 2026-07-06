import Link from 'next/link'
import Icon from '@/components/Icon'
import { firstName } from '@/lib/nav-user'

// Closing call-to-action — auth-aware. Signed out: connect your points.
// Signed in: greet + the programs-synced state, point them at search. Flat teal
// surface, solid, mirrors the verdict hero's confidence.
export default function ConnectBand({
  user,
  programs,
}: {
  user: { name?: string | null; email?: string | null } | null
  programs: number
}) {
  const signedIn = !!user
  const first = firstName(user)

  return (
    <section
      className="px-6 py-9 text-hero-cream sm:px-10 sm:py-11 lg:px-[52px] lg:py-12"
      style={{ background: 'var(--color-brand)' }}
    >
      <div className="flex flex-col items-start gap-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-[48ch]">
          {signedIn ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-deep px-3 py-1 text-[11px] font-semibold uppercase tracking-[var(--track-tag)] text-mint-bright">
                <Icon name="check_circle" size={12} weight="fill" />
                {programs} {programs === 1 ? 'program' : 'programs'} synced
              </span>
              <h2 className="mt-4 text-balance font-display text-[28px] font-semibold leading-[1.06] tracking-[-0.02em] text-white sm:text-[36px]">
                {first ? `Welcome back, ${first}.` : 'Welcome back.'}
                <br />
                Where to next?
              </h2>
              <p className="mt-3 max-w-[40ch] text-[15px] leading-[1.55] text-hero-body">
                Your balances are live. Run a search and your agent will show you
                which way actually wins.
              </p>
            </>
          ) : (
            <>
              <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-hero-eyebrow">
                One last thing
              </span>
              <h2 className="mt-3 text-balance font-display text-[28px] font-semibold leading-[1.06] tracking-[-0.02em] text-white sm:text-[36px]">
                Connect your points.
                <br />
                Get your verdict.
              </h2>
              <p className="mt-3 max-w-[42ch] text-[15px] leading-[1.55] text-hero-body">
                Sign in and link your loyalty programs. Your agent reads your actual
                balances and shows you the math — when miles beat cash and when they
                don&apos;t.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
          {signedIn ? (
            <Link
              href="/account"
              className="inline-flex items-center gap-2 rounded-[14px] border border-white/25 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              <Icon name="settings" size={16} />
              Manage programs
            </Link>
          ) : (
            <>
              {/* Two distinct doors, not the same URL twice: signup is primary,
                  sign in is the quieter return path. Both carry returnTo so the
                  visitor lands back home after auth. */}
              <a
                href="/login?returnTo=%2F"
                className="inline-flex items-center gap-2 rounded-[14px] bg-white px-7 py-3.5 text-[15px] font-semibold text-brand-ink transition-colors hover:bg-hero-white-hover"
              >
                <Icon name="loyalty" size={16} />
                Connect your points
              </a>
              <a
                href="/login?returnTo=%2F"
                className="inline-flex items-center rounded-[14px] border border-white/25 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep"
              >
                Sign in
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
