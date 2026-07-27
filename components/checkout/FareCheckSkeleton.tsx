// Neutral loading placeholder for the /book "confirm this fare" step. OfferGate
// (app/book/page.tsx) re-prices the offer server-side before showing anything —
// that Duffel call can resolve to a compact Notice card (expired fare, passport
// required) OR the full two-column CheckoutForm, and there's no way to know
// which until it returns. Rather than mirror one shape and mismatch the other,
// this stays deliberately small/neutral (Notice's footprint) — worst case is an
// honest expand into the form, never a big skeleton snapping down to a notice.
export default function FareCheckSkeleton() {
  return (
    <div className="mx-auto mt-2 max-w-[560px]">
      <div className="flex items-start gap-4 rounded-[18px] border border-border bg-surface px-4 py-6 sm:px-7 sm:py-7">
        <span className="hop-skeleton block h-11 w-11 flex-shrink-0 rounded-[12px]" />
        <div className="min-w-0 flex-1">
          <span className="hop-skeleton hop-skeleton-line block h-[18px] w-[70%]" />
          <span className="hop-skeleton hop-skeleton-line mt-2.5 block h-[14px] w-[90%]" />
          <span className="hop-skeleton hop-skeleton-line mt-1.5 block h-[14px] w-[60%]" />
        </div>
      </div>
    </div>
  )
}
