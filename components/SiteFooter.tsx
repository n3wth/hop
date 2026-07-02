import Link from 'next/link'
import FooterNav from './FooterNav'
import { SITE_NAME } from '@/lib/seo'

const YEAR = new Date().getFullYear()

// One compact footer. The brand block and nav columns group together on the
// left with fixed gaps — nothing is pinned to opposite ends of the 1760px
// shell — and the legal line is a single hairline row inside the same
// footer, not a second bar.
export default function SiteFooter() {
  return (
    <footer
      role="contentinfo"
      className="mt-16 border-t border-border text-[13px] text-text3"
    >
      <div className="flex flex-col gap-10 py-10 md:flex-row md:items-start md:gap-16 lg:gap-20">
        {/* Brand — quiet, inline */}
        <div className="max-w-[30ch]">
          <Link
            href="/"
            className="wordmark text-[15px] leading-none text-text2 transition-colors hover:text-brand"
          >
            {SITE_NAME}
          </Link>
          <p className="mt-2 leading-[1.6]">
            Points vs. cash — valued in ¢/pt so you always know the smarter way to book.
          </p>
        </div>

        <FooterNav />
      </div>

      {/* Legal row — final hairline row of the same footer */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-hair py-4 text-[11.5px]">
        <span>© {YEAR} {SITE_NAME}</span>
        <span className="hidden sm:inline">Points + cash. Smarter travel.</span>
      </div>
    </footer>
  )
}
