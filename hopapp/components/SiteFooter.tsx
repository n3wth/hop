// Shared site footer — one plain line + real utility links. Used on every page.
export default function SiteFooter() {
  return (
    <footer className="mt-[46px] flex flex-col gap-4 border-t border-border pt-6 text-[12px] tracking-[0.04em] text-text3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        hop compares{' '}
        <b className="font-semibold text-text2">cash, miles, and transfer partners</b> in one search.
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 sm:gap-[22px]">
        <a href="/search" className="transition-colors hover:text-text2">
          Search
        </a>
        <a href="/account" className="transition-colors hover:text-text2">
          Account
        </a>
        <span>How we value points</span>
      </div>
    </footer>
  )
}
