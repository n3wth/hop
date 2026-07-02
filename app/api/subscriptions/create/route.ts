import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth0 } from '@/lib/auth0'
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

// Helper to look up or create Stripe customer in Supabase
async function getOrCreateCustomer(userId: string, email?: string): Promise<string | null> {
  return withDb<string | null>(null, async (db) => {
    // Check if customer already exists
    const { data: customerData } = await db
      .from('hop_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (customerData?.stripe_customer_id) {
      return customerData.stripe_customer_id
    }

    const stripe = getStripe()
    // Create new customer in Stripe
    const stripeCustomer = await stripe.customers.create({
      email,
      metadata: { hop_user_id: userId },
    })

    // Save in DB
    const { error: insertErr } = await db
      .from('hop_customers')
      .insert({
        user_id: userId,
        stripe_customer_id: stripeCustomer.id,
      })

    if (insertErr) return null
    return stripeCustomer.id
  })
}

async function handleCheckout(priceId: string | null) {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  const email = session?.user?.email
  if (!userId) {
    return { error: 'Unauthorized', status: 401 }
  }

  const monthlyId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
  const yearlyId = process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY

  if (!priceId || (priceId !== monthlyId && priceId !== yearlyId)) {
    return { error: 'Invalid priceId', status: 400 }
  }

  const stripeCustomerId = await getOrCreateCustomer(userId, email)
  if (!stripeCustomerId) {
    return { error: 'Failed to create customer', status: 500 }
  }

  const stripe = getStripe()
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/account?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/account`,
  })

  return { url: checkoutSession.url }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const priceId = searchParams.get('priceId')
  const res = await handleCheckout(priceId)
  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: res.status })
  }
  if (res.url) {
    return NextResponse.redirect(res.url, 303)
  }
  return NextResponse.json({ error: 'Failed to initiate checkout' }, { status: 500 })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const res = await handleCheckout(body.priceId)
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }
    return NextResponse.json({ url: res.url })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
