import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserId } from '@/lib/session'
import { safeReturnTo } from '@/lib/safe-return'
import { isGoogleAuthEnabled, isEmailPasswordAuthEnabled, isPasskeyEnabled } from '@/lib/env'
import Logo from '@/components/Logo'
import Icon from '@/components/Icon'
import Eyebrow from '@/components/ui/Eyebrow'
import GoogleSignIn from '@/components/auth/GoogleSignIn'
import EmailPasswordForm from '@/components/auth/EmailPasswordForm'
import PasskeyButton from '@/components/auth/PasskeyButton'

export const metadata: Metadata = {
  title: 'Sign in — hop',
  description: 'Sign in to save searches, track value, and book.',
  robots: { index: false },
}

// safeReturnTo (lib/safe-return.ts) rejects absolute/protocol-relative/
// backslash destinations so returnTo can never become an open redirect.

// Branded welcome / sign-in landing. Auth is Better Auth's Google social login
// (client-initiated POST → Google). Already signed in → returnTo or /account.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const returnTo = safeReturnTo(sp.returnTo)
  const hasError = sp.error != null

  const userId = await getUserId()
  if (userId) redirect(returnTo ?? '/account')

  const callback = returnTo ?? '/account'

  return (
    <main className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(420px,44%)_1fr]">
      {/* brand panel — the editorial half. Desktop only; mobile keeps the calm
          single-column card. Flat ink surface, type does the work; the bunny is
          the one warm moment. */}
      <aside className="relative hidden overflow-hidden bg-brand-ink lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-16">
        <Link href="/" className="relative z-10 self-start text-hero-cream transition-colors hover:text-white">
          <Logo size={28} carve="var(--color-brand-ink)" />
        </Link>

        <div className="relative z-10 max-w-[420px]">
          <Eyebrow as="p" onDark>
            Points or cash
          </Eyebrow>
          <h2 className="mt-4 text-balance font-display text-[40px] font-semibold leading-[1.06] tracking-[-0.02em] text-white xl:text-[46px]">
            Know which one wins before you book.
          </h2>
          <p className="mt-5 max-w-[36ch] text-[15px] leading-[1.6] text-hero-body">
            hop reads published saver charts and cash for the same trip and tells
            you the verdict — with the math to back it.
          </p>
        </div>

        <p className="relative z-10 text-[12.5px] text-hero-label">
          Points vs. cash, valued in ¢/pt.
        </p>

        {/* the warm moment — oversized mark bleeding off the corner */}
        <Logo
          size={340}
          decorative
          carve="var(--color-brand-ink)"
          className="absolute -bottom-16 -right-14 text-brand-muted/40"
        />
      </aside>

      {/* auth column */}
      <div className="flex min-h-dvh flex-col lg:min-h-0">
        <header className="px-6 pt-6 sm:px-10 sm:pt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text2 transition-colors hover:text-text"
          >
            <Icon name="arrow_left" size={16} />
            Back to hop
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:py-16">
          <div className="hop-rise w-full max-w-[400px]">
            {/* mark — mobile/tablet only; the brand panel carries it on desktop */}
            <div className="flex justify-center lg:hidden">
              <span className="grid h-[72px] w-[72px] place-items-center rounded-[20px] bg-brand-light text-brand">
                <Logo size={42} carve="var(--color-brand-light)" />
              </span>
            </div>

            {/* welcome copy */}
            <div className="mt-7 text-center lg:mt-0 lg:text-left">
              <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-text sm:text-[40px]">
                Welcome to hop
              </h1>
              <p className="mt-3 text-[14.5px] leading-[1.55] text-text2">
                Sign in to save searches, track value, and book.
              </p>
            </div>

            {/* error notice */}
            {hasError ? (
              <div
                role="alert"
                className="mt-7 rounded-[12px] border border-weak/40 bg-weak/10 px-4 py-3 text-[13.5px] leading-[1.5] text-text"
              >
                Sign-in didn&rsquo;t go through. Try again.
              </div>
            ) : null}

            {/* actions */}
            <div className="mt-8">
              <GoogleSignIn callbackURL={callback} enabled={isGoogleAuthEnabled()} />

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <Eyebrow>
                  or
                </Eyebrow>
                <div className="h-px flex-1 bg-border" />
              </div>

              <EmailPasswordForm callbackURL={callback} enabled={isEmailPasswordAuthEnabled()} />

              <div className="mt-5">
                <PasskeyButton callbackURL={callback} enabled={isPasskeyEnabled()} />
              </div>
            </div>

            {/* legal-ish footnote */}
            <p className="mt-8 text-center text-[12px] leading-[1.6] text-text3 lg:text-left">
              By continuing you agree to our{' '}
              <Link href="/terms" className="text-text2 underline-offset-2 transition-colors hover:text-text hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-text2 underline-offset-2 transition-colors hover:text-text hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
