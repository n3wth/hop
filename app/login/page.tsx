import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth0 } from '@/lib/auth0'
import Logo from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Sign in — hop',
  description: 'Sign in to save searches, track value, and book.',
}

// Branded welcome / sign-in landing. The actual auth is Auth0 Universal Login
// at /auth/login — this is a calm, on-brand handoff. Already signed in → /account.
export default async function LoginPage() {
  const session = await auth0.getSession()
  if (session) redirect('/account')

  return (
    <main className="flex min-h-dvh flex-col bg-bg">
      {/* top: back to hop */}
      <header className="px-6 pt-6 sm:px-10 sm:pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text2 transition-colors hover:text-text"
        >
          <span aria-hidden className="text-[15px] leading-none">
            ←
          </span>
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

          {/* actions */}
          <div className="mt-8">
            <a
              href="/auth/login"
              className="flex h-[52px] w-full items-center justify-center rounded-[14px] bg-brand text-[15px] font-semibold text-[#eafaf7] transition-colors hover:bg-brand-deep"
            >
              Continue
            </a>

            <div className="my-5 flex items-center gap-3 text-[12px] text-text3">
              <span className="h-px flex-1 bg-hair" aria-hidden />
              New to hop?
              <span className="h-px flex-1 bg-hair" aria-hidden />
            </div>

            <a
              href="/auth/login?screen_hint=signup"
              className="flex h-[52px] w-full items-center justify-center rounded-[14px] border border-border bg-surface text-[15px] font-semibold text-text transition-colors hover:bg-sunk"
            >
              Create account
            </a>
          </div>

          {/* legal-ish footnote */}
          <p className="mx-auto mt-8 max-w-[38ch] text-center text-[12px] leading-[1.6] text-text3">
            Secure sign-in handled by hop. By continuing you agree to our{' '}
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
