import Link from 'next/link'
import FooterNav from './FooterNav'
import { SITE_NAME } from '@/lib/seo'

// One compact footer, given real editorial weight: a confident wordmark and a
// standalone value statement (not a caption tucked under the logo), balanced
// against the nav columns.
export default function SiteFooter({ flush = false }: { flush?: boolean }) {
  return (
    <footer
      role="contentinfo"
      // hidden below md: on phones the bottom tab bar is the persistent nav, and
      // a tall footer under it read as redundant chrome (2026-07 mobile pass).
      className={`relative hidden text-[13px] text-text3 md:block ${
        flush ? 'rounded-b-[20px] bg-paper lg:rounded-b-[28px]' : 'mt-20 border-t border-border'
      }`}
    >
      {/* Non-flush: no horizontal padding here — <main>'s own gutter (AppShell.tsx)
          already provides it, matching every other page-content wrapper. Flush:
          this footer sits inside the same card as ConnectBand (no main gutter
          reaches inside the card), so it needs ConnectBand's own px-* values to
          keep both halves' content aligned to the same left/right edge. */}
      <div
        className={`mx-auto max-w-[var(--container-shell)] ${
          flush ? 'px-6 sm:px-10 lg:px-[52px]' : ''
        }`}
      >
        <div className="flex flex-col gap-12 py-14 lg:flex-row lg:items-start lg:justify-between lg:gap-16 lg:py-16">
          {/* Brand — the statement gets its own line, full display weight */}
          <div className="flex max-w-[68ch] flex-shrink-0 flex-col text-center lg:text-left">
            <Link
              href="/"
              className="wordmark text-[26px] leading-none text-text transition-colors hover:text-brand"
            >
              {SITE_NAME}
            </Link>
            <p className="mt-4 font-display text-[19px] font-semibold leading-[1.3] tracking-[-0.01em] text-text2">
              Points vs. cash, priced in ¢/pt —
              <br />
              so you always know which one wins.
            </p>
          </div>

          <div className="flex-1 lg:flex lg:justify-end">
            <FooterNav />
          </div>
        </div>
      </div>
    </footer>
  )
}
