import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { withDb } from '@/lib/supabase-helpers'

export async function GET() {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get customer id
  const customerId = await withDb<string | null>(null, async (db) => {
    const { data, error } = await db
      .from('hop_customers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    return data.id
  })

  if (!customerId) {
    return NextResponse.json({ subscription: null, isActive: false })
  }

  interface DbSubscription {
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired'
    current_period_end: string
    cancel_at_period_end: boolean
    stripe_price_id: string
  }

  // Get latest subscription
  const sub = await withDb<DbSubscription | null>(null, async (db) => {
    const { data, error } = await db
      .from('hop_subscriptions')
      .select('status, current_period_end, cancel_at_period_end, stripe_price_id')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return data as DbSubscription
  })

  if (!sub) {
    return NextResponse.json({ subscription: null, isActive: false })
  }

  const isActive = (sub.status === 'active' || sub.status === 'trialing') && new Date(sub.current_period_end) > new Date()
  return NextResponse.json({ subscription: sub, isActive })
}
