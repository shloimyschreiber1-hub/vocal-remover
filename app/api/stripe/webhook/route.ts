import { createAdminClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/profiles'
import { adjustCredits } from '@/lib/credits-server'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  console.log('[Webhook] Received request')
  
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    console.error('[Webhook] No signature in request')
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
    console.log('[Webhook] Event verified:', event.type)
  } catch (error) {
    console.error('[Webhook] Signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    console.log('[Webhook] Processing checkout.session.completed:', session.id)

    const userId = session.metadata?.userId
    const creditsToAdd = parseInt(session.metadata?.creditsToAdd || '0')
    const stripeSessionId = session.id
    const amountUsd = (session.amount_total || 0) / 100

    console.log('[Webhook] Metadata:', { userId, creditsToAdd, stripeSessionId, amountUsd })

    if (!userId || !creditsToAdd) {
      console.error('[Webhook] Missing metadata in session:', session.id)
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    // Use admin client to bypass RLS - webhook comes from Stripe, not user browser
    const supabase = createAdminClient()
    console.log('[Webhook] Admin client created')

    // Idempotency: Stripe delivers webhooks *at least once* and retries on any
    // non-2xx / timeout. Without this guard a duplicate delivery would credit
    // the user again. We key off the (already-recorded) purchase row for the
    // session. NOTE: a UNIQUE constraint on credit_purchases.stripe_session_id
    // should also be added at the DB level to close the last concurrency gap.
    const { data: existingPurchase, error: existingError } = await supabase
      .from('credit_purchases')
      .select('id')
      .eq('stripe_session_id', stripeSessionId)
      .maybeSingle()

    if (existingError) {
      console.error('[Webhook] Error checking existing purchase:', existingError)
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
    }

    if (existingPurchase) {
      console.log('[Webhook] Duplicate delivery, already processed:', stripeSessionId)
      return NextResponse.json({ received: true, duplicate: true })
    }

    const { error: profileError } = await getOrCreateProfile(supabase, userId)

    if (profileError) {
      console.error('[Webhook] Profile lookup/create error:', profileError, 'userId:', userId)
      return NextResponse.json({ error: 'Profile unavailable' }, { status: 500 })
    }

    // Record the purchase FIRST so it acts as the idempotency marker. If two
    // deliveries race, the second will find the row on its next attempt.
    const { error: purchaseError } = await supabase.from('credit_purchases').insert({
      user_id: userId,
      stripe_session_id: stripeSessionId,
      credits_purchased: creditsToAdd,
      amount_usd: amountUsd,
    })

    if (purchaseError) {
      console.error('[Webhook] Error recording purchase:', purchaseError)
      return NextResponse.json({ error: 'Purchase recording failed' }, { status: 500 })
    }

    console.log('[Webhook] Purchase recorded, adding credits:', creditsToAdd)

    const { credits: newCredits, error: creditError } = await adjustCredits(
      supabase,
      userId,
      creditsToAdd
    )

    if (creditError) {
      console.error('[Webhook] Error updating credits:', creditError)
      // Roll back the idempotency marker so Stripe's retry re-processes this
      // session instead of short-circuiting as a "duplicate" with no credits.
      await supabase
        .from('credit_purchases')
        .delete()
        .eq('stripe_session_id', stripeSessionId)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    console.log('[Webhook] Credits updated to:', newCredits)
  } else {
    console.log('[Webhook] Ignoring event type:', event.type)
  }

  return NextResponse.json({ received: true })
}
