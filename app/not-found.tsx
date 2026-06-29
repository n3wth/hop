import Link from 'next/link'
import Logo from '@/components/Logo'

// 404 boundary. Renders inside the root layout, so the cream canvas + grain
// frame the page (nav/footer aren't part of this route's tree, but the layout
// chrome persists). Branded, terse — mirrors error.tsx's composition: linked
// logo, a short headline, one body line, and two ways forward.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-76px)] max-w-[1440px] flex-col items-center justify-center px-16 text-center">
      <div className="hop-rise grid place-items-center" style={{ ['--hop-delay' as string]: '40ms' }}>
        <Link href="/" aria-label="hop — home" className="grid place-items-center">
          <Logo size={92} carve="var(--color-bg)" className="text-brand" decorative />
        </Link>
      </div>

      <h1
        className="hop-rise mt-7 font-display text-[34px] font-semibold tracking-[-0.02em] text-text"
        style={{ ['--hop-delay' as string]: '100ms' }}
      >
        This page took a wrong turn.
      </h1>

      <p
        className="hop-rise mt-3 max-w-[44ch] text-[16px] leading-[1.55] text-text2"
        style={{ ['--hop-delay' as string]: '160ms' }}
      >
        We couldn&apos;t find what you were looking for. Head back, or search a route.
      </p>

      <div className="hop-rise mt-8 flex items-center gap-3" style={{ ['--hop-delay' as string]: '220ms' }}>
        <Link
          href="/"
          className="inline-flex items-center rounded-[14px] bg-brand px-7 py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          Back to hop
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center rounded-[14px] border border-border bg-surface px-7 py-[15px] text-[15px] font-semibold text-text transition-colors hover:bg-sunk"
        >
          Search flights
        </Link>
      </div>
    </div>
  )
}
