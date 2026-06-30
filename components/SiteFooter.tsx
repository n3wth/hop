import Link from 'next/link'
import FooterNav from './FooterNav'
import { SITE_NAME } from '@/lib/seo'

const YEAR = new Date().getFullYear()

export default function SiteFooter() {
  return (
    <footer
      role="contentinfo"
      className="mt-14 border-t border-border pt-5 pb-3 text-[13px] font-normal text-text3 sm:mt-16 sm:pt-6 sm:pb-4"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <div className="max-w-[360px]">
          <Link
            href="/"
            className="font-display text-[15px] font-semibold text-text transition-colors hover:text-brand"
          >
            {SITE_NAME}
          </Link>
          <p className="mt-2 leading-[1.55]">
            hop is a quieter way to decide when points beat cash.
          </p>
          <p className="mt-3 text-[12px] text-text3">
            &copy; {YEAR} {SITE_NAME}
          </p>
        </div>

        <FooterNav />
      </div>
    </footer>
  )
}
