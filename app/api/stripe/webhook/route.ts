import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const userId = session.metadata?.userId
    const creditsToAdd = parseInt(session.metadata?.creditsToAdd || '0')
    const stripeSessionId = session.id
    const amountGbp = (session.amount_total || 0) / 100

    if (!userId || !creditsToAdd) {
      console.error('Missing metadata in session:', session.id)
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    // Use admin client to bypass RLS - webhook comes from Stripe, not user browser
    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!profile) {
      console.error('Profile not found for user:', userId)
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits: profile.credits + creditsToAdd })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating credits:', updateError)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    const { error: purchaseError } = await supabase.from('credit_purchases').insert({
      user_id: userId,
      stripe_session_id: stripeSessionId,
      credits_purchased: creditsToAdd,
      amount_gbp: amountGbp,
    })

    if (purchaseError) {
      console.error('Error recording purchase:', purchaseError)
    }
  }

  return NextResponse.json({ received: true })
}
