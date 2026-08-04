import type { Metadata } from 'next'
import Link from 'next/link'
import Logo from '@/components/Logo'
import Icon from '@/components/Icon'
import Eyebrow from '@/components/ui/Eyebrow'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Reset your password — hop',
  robots: { index: false },
}

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(420px,44%)_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-ink lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-16">
        <Link href="/" className="relative z-10 self-start text-hero-cream transition-colors hover:text-white">
          <Logo size={28} carve="var(--color-brand-ink)" />
        </Link>
        <div className="relative z-10 max-w-[34ch]">
          <Eyebrow as="p" onDark>
            Points or cash
          </Eyebrow>
          <h2 className="mt-4 text-balance font-display text-[40px] font-semibold leading-[1.06] tracking-[-0.02em] text-white xl:text-[46px]">
            Know which one wins before you book.
          </h2>
        </div>
        <p className="relative z-10 text-[12.5px] text-hero-label">Points + cash. Smarter travel.</p>
        <Logo size={340} decorative carve="var(--color-brand-ink)" className="absolute -bottom-16 -right-14 text-brand-muted/40" />
      </aside>

      <div className="flex min-h-dvh flex-col lg:min-h-0">
        <header className="px-6 pt-6 sm:px-10 sm:pt-8">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text2 transition-colors hover:text-text">
            <Icon name="arrow_left" size={16} />
            Back to sign in
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:py-16">
          <div className="hop-rise w-full max-w-[400px]">
            <div className="flex justify-center lg:hidden">
              <span className="grid h-[72px] w-[72px] place-items-center rounded-[20px] bg-brand-light text-brand">
                <Logo size={42} carve="var(--color-brand-light)" />
              </span>
            </div>

            <div className="mt-7 text-center lg:mt-0 lg:text-left">
              <h1 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-text sm:text-[34px]">
                Reset your password
              </h1>
              <p className="mx-auto mt-3 max-w-[34ch] text-[14.5px] leading-[1.55] text-text2 lg:mx-0">
                Enter your email and we&rsquo;ll send you a reset link.
              </p>
            </div>

            <div className="mt-8">
              <ForgotPasswordForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
