import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserId } from '@/lib/session'
import { isGoogleAuthEnabled } from '@/lib/env'
import Logo from '@/components/Logo'
import Icon from '@/components/Icon'
import GoogleSignIn from '@/components/auth/GoogleSignIn'

export const metadata: Metadata = {
  title: 'Sign in — hop',
  description: 'Sign in to save searches, track value, and book.',
  robots: { index: false },
}

// Only allow same-origin, app-relative returnTo paths. Reject absolute URLs,
// protocol-relative ('//evil.com'), and backslash tricks to prevent open redirects.
function safeReturnTo(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (!v) return null
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.includes('\\')) return null
  return v
}

// Branded welcome / sign-in landing. Auth is Better Auth's Google social login
// (client-initiated POST → Google). Already signed in → /account.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const returnTo = safeReturnTo(sp.returnTo)
  const hasError = sp.error != null

  const userId = await getUserId()
  if (userId) redirect('/account')

  const callback = returnTo ?? '/account'

  return (
    <main className="flex min-h-dvh flex-col bg-bg">
      {/* top: back to hop */}
      <header className="px-6 pt-6 sm:px-10 sm:pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text2 transition-colors hover:text-text"
        >
          <Icon name="arrow_left" size={16} />
          Back to hop
        </Link>
      </header>

      {/* center: welcome card */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 sm:py-16">
        <div className="hop-rise w-full max-w-[420px]">
          {/* mark */}
          <div className="flex justify-center">
            <span className="grid h-[72px] w-[72px] place-items-center rounded-[20px] bg-brand-light text-brand">
              <Logo size={42} carve="var(--color-brand-light)" />
            </span>
          </div>

          {/* welcome copy */}
          <div className="mt-7 text-center">
            <h1 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-text sm:text-[34px]">
              Welcome to hop
            </h1>
            <p className="mx-auto mt-3 max-w-[34ch] text-[14.5px] leading-[1.55] text-text2">
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
          </div>

          {/* legal-ish footnote */}
          <p className="mx-auto mt-8 max-w-[38ch] text-center text-[12px] leading-[1.6] text-text3">
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
    </main>
  )
}
