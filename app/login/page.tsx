import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth0 } from '@/lib/auth0'
import Logo from '@/components/Logo'
import Icon from '@/components/Icon'
import Button from '@/components/ui/Button'

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

// Branded welcome / sign-in landing. The actual auth is Auth0 Universal Login
// at /auth/login — this is a calm, on-brand handoff. Already signed in → /account.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const returnTo = safeReturnTo(sp.returnTo)
  const hasError = sp.error != null

  const session = await auth0.getSession()
  if (session) redirect(returnTo ?? '/account')

  const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''
  const signupQs = returnTo
    ? `?screen_hint=signup&returnTo=${encodeURIComponent(returnTo)}`
    : '?screen_hint=signup'

  return (
    <main className="flex min-h-dvh flex-col bg-bg">
      {/* top: back to hop */}
      <header className="px-6 pt-6 sm:px-10 sm:pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text2 transition-colors hover:text-text"
        >
          <Icon name="expand_more" size={18} className="rotate-90" />
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
            <Button href={`/auth/login${qs}`} native fullWidth>
              Continue
            </Button>

            <div className="my-5 flex items-center gap-3 text-[12px] text-text3">
              <span className="h-px flex-1 bg-hair" aria-hidden />
              or
              <span className="h-px flex-1 bg-hair" aria-hidden />
            </div>

            <Button href={`/auth/login${signupQs}`} native variant="secondary" fullWidth>
              Create account
            </Button>
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
