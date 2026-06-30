import AppShell from '@/components/AppShell'

// Route-level loading UI for /ask. The concierge IS the page — a full-viewport
// ink hero (ConciergeHero, density="full") — so without this, the immersive
// stage is simply blank while the session/balances/photos resolve. Mirrors
// ConciergeHero's empty-state shape (eyebrow, headline, sub, composer, starter
// chips) on the same ink panel so the real hero swaps in with no jump. Static
// placeholders, not .hop-skeleton shimmer — same convention as the teal hero
// in app/book/confirmation/loading.tsx (the shimmer is tuned for light surfaces).
export default function Loading() {
  return (
    <AppShell hideSearch noPadX>
      <div className="hop-ask-stage flex flex-col">
        <div
          className="relative flex flex-1 flex-col items-center justify-center px-5 py-8 text-center sm:px-10"
          style={{ background: 'var(--color-brand-ink)' }}
        >
          <span className="inline-flex h-[30px] w-[120px] items-center justify-center rounded-full bg-brand-deep" />

          <span className="mt-6 block h-[40px] w-[78%] max-w-[480px] rounded-[10px] bg-white/15 sm:h-[56px]" />
          <span className="mt-3 block h-[40px] w-[55%] max-w-[340px] rounded-[10px] bg-white/15 sm:h-[56px]" />

          <span className="mt-5 block h-[15px] w-[70%] max-w-[420px] rounded-[6px] bg-white/10" />
          <span className="mt-2 block h-[15px] w-[50%] max-w-[300px] rounded-[6px] bg-white/10" />

          <div className="mt-8 w-full max-w-[600px]">
            <span className="block h-[52px] w-full rounded-[16px] bg-white/90" />
          </div>

          <div className="mt-6 grid w-full max-w-[560px] grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className="h-[42px] rounded-full border border-white/20 bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
