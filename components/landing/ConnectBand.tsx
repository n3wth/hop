import Icon from '@/components/Icon'

// Closing call-to-action — auth-aware. Signed out: connect your points.
// Signed in: greet + the programs-synced state, point them at search. Flat teal
// surface, solid, mirrors the verdict hero's confidence.
export default function ConnectBand({
  user,
  programs,
}: {
  user: { name?: string } | null
  programs: number
}) {
  const signedIn = !!user
  const first = user?.name?.trim().split(' ')[0]

  return (
    <section
      className="overflow-hidden rounded-[20px] px-6 py-9 text-[#eafaf7] sm:px-10 sm:py-11 lg:rounded-[28px] lg:px-[52px] lg:py-12"
      style={{ background: 'var(--color-brand)' }}
    >
      <div className="flex flex-col items-start gap-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-[48ch]">
          {signedIn ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#0a5757] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6ff0d2]">
                <Icon name="check_circle" size={13} />
                {programs} {programs === 1 ? 'program' : 'programs'} synced
              </span>
              <h2 className="mt-4 font-display text-[28px] font-semibold leading-[1.06] tracking-[-0.02em] text-white sm:text-[36px]">
                {first ? `Welcome back, ${first}.` : 'Welcome back.'}
                <br />
                Where to next?
              </h2>
              <p className="mt-3 max-w-[40ch] text-[15px] leading-[1.55] text-[#c7ece5]">
                Your balances are live. Run a search and your agent will show you
                which way actually wins.
              </p>
            </>
          ) : (
            <>
              <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#9fe0d6]">
                Meet your agent
              </span>
              <h2 className="mt-3 font-display text-[28px] font-semibold leading-[1.06] tracking-[-0.02em] text-white sm:text-[36px]">
                Connect your points.
                <br />
                Get your verdict.
              </h2>
              <p className="mt-3 max-w-[42ch] text-[15px] leading-[1.55] text-[#c7ece5]">
                Sign in and link your loyalty programs. Your agent reads your actual
                balances and shows you the math — when miles beat cash and when they
                don&apos;t.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
          {signedIn ? (
            <a
              href="/account"
              className="inline-flex items-center gap-2 rounded-[14px] border border-white/25 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0a5757]"
            >
              <Icon name="settings" size={18} />
              Manage programs
            </a>
          ) : (
            <>
              <a
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-[14px] bg-white px-7 py-3.5 text-[15px] font-semibold text-[#073e3e] transition-colors hover:bg-[#fffdf6]"
              >
                <Icon name="loyalty" size={18} />
                Connect your points
              </a>
              <a
                href="/auth/login"
                className="inline-flex items-center rounded-[14px] border border-white/25 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0a5757]"
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
