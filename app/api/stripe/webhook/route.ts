import { createAdminClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/profiles'
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
    const amountGbp = (session.amount_total || 0) / 100

    console.log('[Webhook] Metadata:', { userId, creditsToAdd, stripeSessionId, amountGbp })

    if (!userId || !creditsToAdd) {
      console.error('[Webhook] Missing metadata in session:', session.id)
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    // Use admin client to bypass RLS - webhook comes from Stripe, not user browser
    const supabase = createAdminClient()
    console.log('[Webhook] Admin client created')

    const { data: profile, error: profileError } = await getOrCreateProfile(supabase, userId)

    if (profileError || !profile) {
      console.error('[Webhook] Profile lookup/create error:', profileError, 'userId:', userId)
      return NextResponse.json({ error: 'Profile unavailable' }, { status: 500 })
    }

    console.log('[Webhook] Current credits:', profile.credits, 'Adding:', creditsToAdd)

    const newCredits = profile.credits + creditsToAdd
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', userId)

    if (updateError) {
      console.error('[Webhook] Error updating credits:', updateError)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    console.log('[Webhook] Credits updated to:', newCredits)

    const { error: purchaseError } = await supabase.from('credit_purchases').insert({
      user_id: userId,
      stripe_session_id: stripeSessionId,
      credits_purchased: creditsToAdd,
      amount_gbp: amountGbp,
    })

    if (purchaseError) {
      console.error('[Webhook] Error recording purchase:', purchaseError)
      // Don't fail the webhook if purchase recording fails, credits were still added
    } else {
      console.log('[Webhook] Purchase recorded successfully')
    }
  } else {
    console.log('[Webhook] Ignoring event type:', event.type)
  }

  return NextResponse.json({ received: true })
}
