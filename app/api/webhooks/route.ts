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

export async function POST(request: Request) {
  const buf = await request.text()
  const sig = request.headers.get('stripe-signature') || ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('⚠️  Missing STRIPE_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Webhook secret unconfigured' }, { status: 500 })
  }

  let event: Stripe.Event
  const stripe = getStripe()

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret)
  } catch (err) {
    console.error(`⚠️  Webhook signature verification failed: ${err}`)
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { customer, subscription } = session
        if (typeof customer === 'string' && typeof subscription === 'string') {
          const sub = await stripe.subscriptions.retrieve(subscription)
          await upsertSubscription(customer, sub)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        if (typeof sub.customer === 'string') {
          await upsertSubscription(sub.customer, sub)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as unknown as { subscription: string }).subscription
        if (typeof invoice.customer === 'string' && typeof subscriptionId === 'string') {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          await upsertSubscription(invoice.customer, sub)
        }
        break
      }
      default:
        console.log(`🔔  Unhandled event type ${event.type}`)
    }
  } catch (err) {
    console.error(`⚠️  Failed to process webhook event: ${err}`)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

/**
 * Upserts a subscription record in hop_subscriptions.
 */
async function upsertSubscription(
  stripeCustomerId: string,
  sub: Stripe.Subscription
) {
  interface DbCustomer {
    id: string
    user_id: string
  }

  // Get hop customer
  const custData = await withDb<DbCustomer | null>(null, async (db) => {
    const { data, error } = await db
      .from('hop_customers')
      .select('id, user_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle()
    if (error || !data) return null
    return data as DbCustomer
  })

  if (!custData) {
    throw new Error(`Customer not found for Stripe ID: ${stripeCustomerId}`)
  }

  interface DbSubscriptionId {
    id: string
  }

  // Check if subscription exists
  const existingSub = await withDb<DbSubscriptionId | null>(null, async (db) => {
    const { data, error } = await db
      .from('hop_subscriptions')
      .select('id')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle()
    if (error || !data) return null
    return data as DbSubscriptionId
  })

  const subObj = sub as unknown as {
    current_period_start: number
    current_period_end: number
  }

  const payload = {
    customer_id: custData.id,
    stripe_subscription_id: sub.id,
    stripe_price_id: sub.items.data[0]?.price.id ?? '',
    status: sub.status as 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired',
    current_period_start: new Date(subObj.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subObj.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }

  await withDb(false, async (db) => {
    if (existingSub) {
      const { error } = await db
        .from('hop_subscriptions')
        .update(payload)
        .eq('id', existingSub.id)
      if (error) throw error
      return true
    } else {
      const { error } = await db
        .from('hop_subscriptions')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
      if (error) throw error
      return true
    }
  })
}
