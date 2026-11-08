import Link from 'next/link'
import FooterNav from './FooterNav'
import Icon from './Icon'

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
        <div className="grid gap-8 py-10 xl:grid-cols-[minmax(180px,1fr)_3fr] xl:gap-12">
          <div className="flex flex-col items-start">
            <Link
              href="/"
              className="wordmark text-[16px] font-bold leading-none text-text2 transition-colors hover:text-brand"
            >
              hop.flights
            </Link>
            <p className="mt-2.5 text-[14px] leading-[1.6]">
              Points vs. cash, valued in ¢/pt.
            </p>
          </div>
          <FooterNav />
        </div>
        <div className="flex items-center justify-between border-t border-border py-5">
          <span className="text-[12px] text-text3">© {YEAR} hop.flights</span>
          <a
            href="https://github.com/n3wth/hop"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="hop on GitHub"
            className="inline-flex items-center gap-2 text-text2 transition-colors hover:text-brand"
          >
            <Icon name="github" size={20} />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
