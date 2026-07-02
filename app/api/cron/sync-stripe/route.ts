import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { withDb } from '@/lib/supabase-helpers'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
    _stripe = new Stripe(key, {
      apiVersion: '2023-10-16' as never,
    })
  }
  return _stripe
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  try {
    const stripe = getStripe()
    // Fetch all active/past_due/trialing/canceled subscriptions from Stripe
    const subs = await stripe.subscriptions.list({
      limit: 100,
      status: 'all',
    })

    let syncedCount = 0

    for (const sub of subs.data) {
      if (typeof sub.customer === 'string') {
        const ok = await syncSubscription(sub.customer, sub)
        if (ok) syncedCount++
      }
    }

    return NextResponse.json({ ok: true, synced: syncedCount })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`⚠️  Stripe subscription sync failed: ${msg}`)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

async function syncSubscription(stripeCustomerId: string, sub: Stripe.Subscription): Promise<boolean> {
  return withDb<boolean>(false, async (db) => {
    // 1. Get customer
    const { data: cust } = await db
      .from('hop_customers')
      .select('id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle()

    if (!cust) return false

    // 2. Check if subscription already exists
    const { data: existing } = await db
      .from('hop_subscriptions')
      .select('id')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle()

    const subObj = sub as unknown as {
      current_period_start: number
      current_period_end: number
    }

    const payload = {
      customer_id: cust.id,
      stripe_subscription_id: sub.id,
      stripe_price_id: sub.items.data[0]?.price.id ?? '',
      status: sub.status as 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired',
      current_period_start: new Date(subObj.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subObj.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error } = await db
        .from('hop_subscriptions')
        .update(payload)
        .eq('id', existing.id)
      return !error
    } else {
      const { error } = await db
        .from('hop_subscriptions')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
      return !error
    }
  })
}
