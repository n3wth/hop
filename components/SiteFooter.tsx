import Link from 'next/link'
import FooterNav from './FooterNav'
import { SITE_NAME } from '@/lib/seo'

const YEAR = new Date().getFullYear()

export default function SiteFooter() {
  return (
    <footer
      role="contentinfo"
      className="mt-16 border-t border-border pt-8 text-[13px] text-text3"
    >
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
        {/* Brand */}
        <div className="max-w-[28ch] flex-shrink-0">
          <Link
            href="/"
            className="wordmark text-[22px] leading-none text-text2 transition-colors hover:text-brand"
          >
            {SITE_NAME}
          </Link>
          <p className="mt-2.5 leading-[1.6]">
            Points vs. cash — valued in ¢/pt so you always know the smarter way to book.
          </p>
        </div>

        <FooterNav />
      </div>

      {/* Bottom bar */}
      <div className="mt-8 flex items-center justify-between border-t border-hair pt-5 text-[11.5px]">
        <span>© {YEAR} {SITE_NAME}</span>
        <span className="hidden sm:block">Points + cash. Smarter travel.</span>
      </div>
    </footer>
  )
}
