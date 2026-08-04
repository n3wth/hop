// Loading placeholder for LegalShell — mirrors its exact measure (max-w-[72ch])
// and rhythm (eyebrow, display h1, intro line, prose block) so support/terms/
// privacy swap in without a layout shift. Shared by their three loading.tsx
// files since all three wrap LegalShell identically.
function Bar({ className }: { className?: string }) {
  return <span className={`hop-skeleton block rounded-[6px] ${className ?? ''}`} />
}

export default function LegalShellSkeleton() {
  return (
    <div className="mx-auto max-w-[72ch] px-1">
      <header className="pt-10 sm:pt-14">
        <Bar className="h-[12px] w-[64px]" />
        <Bar className="mt-3 h-[36px] w-[70%] sm:h-[46px]" />
        <Bar className="mt-4 h-[17px] w-full" />
        <Bar className="mt-2 h-[17px] w-[85%]" />
      </header>

      <div className="mt-9 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bar key={i} className={`h-[16px] ${i % 3 === 2 ? 'w-[60%]' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )
}
