'use client'

import { useEffect, useState } from 'react'

interface SubscriptionStatus {
  isActive: boolean
  loading: boolean
}

export default function SubscriptionPaywall({
  children,
  monthlyPriceId,
  yearlyPriceId,
}: {
  children: React.ReactNode
  monthlyPriceId: string
  yearlyPriceId: string
}) {
  const [status, setStatus] = useState<SubscriptionStatus>({
    isActive: false,
    loading: true,
  })

  useEffect(() => {
    let active = true
    async function fetchStatus() {
      try {
        const res = await fetch('/api/subscriptions/status')
        const json = await res.json()
        if (active) {
          setStatus({ isActive: json.isActive ?? false, loading: false })
        }
      } catch {
        if (active) {
          setStatus({ isActive: false, loading: false })
        }
      }
    }
    fetchStatus()
    return () => {
      active = false
    }
  }, [])

  if (status.loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="font-sans text-text3 text-sm animate-pulse">Loading status...</span>
      </div>
    )
  }

  if (status.isActive) {
    return <>{children}</>
  }

  return (
    <div className="max-w-md mx-auto my-8 bg-paper border border-border rounded-lg p-8 text-center">
      <h2 className="font-display text-2xl font-bold text-text mb-3">
        Hop Premium
      </h2>
      <p className="font-sans text-text2 text-sm mb-6 leading-relaxed">
        Unlock proactive standing order alerts and unlimited destination searches.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
        <a
          href={`/api/subscriptions/create?priceId=${monthlyPriceId}`}
          className="bg-brand hover:bg-brand-deep text-white font-sans font-medium text-sm px-5 py-2.5 rounded-md transition-colors"
        >
          $9.99 / month
        </a>
        <a
          href={`/api/subscriptions/create?priceId=${yearlyPriceId}`}
          className="bg-brand hover:bg-brand-deep text-white font-sans font-medium text-sm px-5 py-2.5 rounded-md transition-colors"
        >
          $99 / year
        </a>
      </div>
      <p className="font-sans text-text3 text-xs">
        Billed securely via Stripe. Cancel anytime.
      </p>
    </div>
  )
}
