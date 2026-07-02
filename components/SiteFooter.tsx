import Link from 'next/link'
import FooterNav from './FooterNav'
import { SITE_NAME, SITE_SOCIAL } from '@/lib/seo'

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
          <p className="mt-2 text-[14px] leading-[1.6]">
            Points vs. cash — valued in ¢/pt so you always know the smarter way to book.
          </p>

          {/* Social Parking */}
          <div className="mt-5 flex items-center gap-4 text-text4">
            <a
              href={SITE_SOCIAL.x}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-brand"
              aria-label="Follow hop on X"
            >
              <svg className="h-4 w-4 fill-current"><path d="M11.53 3.65h2.46l-5.38 6.15 6.33 7.04h-4.96l-3.89-6.47-4.44 6.47H.38l5.77-6.59L-.22 3.65h5.08l3.52 4.65 3.15-4.65Zm-.86 11.72h1.36L4.01 4.78H2.55l6.66 10.59Z" /></svg>
            </a>
            <a
              href={SITE_SOCIAL.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-brand"
              aria-label="Follow hop on Instagram"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.774 4.919 4.851.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.075-1.664 4.704-4.919 4.852-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.775-4.919-4.853-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.075 1.664-4.704 4.919-4.852 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.66.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-5.838 2.435-5.838 5.838s2.435 5.838 5.838 5.838 5.838-2.435 5.838-5.838-2.435-5.838-5.838-5.838zm0 9.513c-2.03 0-3.675-1.645-3.675-3.675s1.645-3.675 3.675-3.675 3.675 1.645 3.675 3.675-1.645 3.675-3.675 3.675zm5.848-11.515c.73 0 1.323.593 1.323 1.323s-.593 1.323-1.323 1.323-1.323-.593-1.323-1.323.593-1.323 1.323-1.323z" /></svg>
            </a>
            <a
              href={SITE_SOCIAL.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-brand"
              aria-label="Follow hop on TikTok"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.44-4.14-1.24-.09 1.96 0 3.92 0 5.88 0 2.34-.78 4.79-2.65 6.22-2.12 1.59-5.18 1.87-7.46.75-2.58-1.28-4.04-4.22-3.61-7.05.29-2.09 1.71-4.03 3.7-4.78.68-.26 1.4-.41 2.13-.44V13.41c-.69.05-1.37.28-1.92.73-1.02.8-1.27 2.37-.62 3.44.59.98 1.9 1.47 2.97 1.12 1.11-.33 1.83-1.5 1.77-2.64V0h-.01z"/></svg>
            </a>
          </div>
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
