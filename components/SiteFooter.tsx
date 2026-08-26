import Link from 'next/link'
import FooterNav from './FooterNav'

const YEAR = new Date().getFullYear()

export default function SiteFooter({ flush = false }: { flush?: boolean }) {
  return (
    <footer
      role="contentinfo"
      className={`relative hidden text-[13px] text-text3 md:block ${
        flush ? 'rounded-b-[20px] bg-paper lg:rounded-b-[28px]' : 'mt-20 border-t border-border'
      }`}
    >
      <div
        className={`mx-auto max-w-[var(--container-app)] ${
          flush ? 'px-6 sm:px-10 lg:px-[52px]' : ''
        }`}
      >
        <div className="flex flex-col gap-10 py-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          {/* Brand — quiet, inline */}
          <div className="flex max-w-[42ch] flex-shrink-0 flex-col text-center lg:text-left">
            <Link
              href="/"
              className="wordmark text-[16px] font-bold leading-none text-text2 transition-colors hover:text-brand"
            >
              hop.flights
            </Link>
            <p className="mt-2.5 text-[14px] leading-[1.6]">
              Points vs. cash — valued in ¢/pt so you always know the smarter way to book.
            </p>

            {/* No social links yet — the handles aren't registered. Restore the
                row (and a SITE_SOCIAL config in lib/seo.ts) once accounts exist. */}

            {/* Consolidated copyright & slogan inline inside the brand column */}
            <div className="mt-6 text-[11.5px] text-text4">
              © {YEAR} hop.flights · Points + cash. Smarter travel.
            </div>
          </div>

          <div className="flex-1 lg:flex lg:justify-end">
            <FooterNav />
          </div>
        </div>
      </div>
    </footer>
  )
}
