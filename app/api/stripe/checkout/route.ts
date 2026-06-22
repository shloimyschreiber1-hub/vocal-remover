import { getOrCreateProfile } from '@/lib/profiles'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PACKS = {
  starter: { credits: 1, price: 499 },
  producer: { credits: 3, price: 10 },
  studio: { credits: 10, price: 2599 },
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Checkout] Starting checkout request')
    
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      console.error('[Checkout] No auth header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('[Checkout] Auth failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Checkout] User authenticated:', user.id)

    const body = await request.json()
    const { pack } = body

    console.log('[Checkout] Pack requested:', pack)

    if (!pack || !(pack in PACKS)) {
      console.error('[Checkout] Invalid pack:', pack)
      return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })
    }

    const selectedPack = PACKS[pack as keyof typeof PACKS]
    console.log('[Checkout] Selected pack:', selectedPack)

    const { error: profileError } = await getOrCreateProfile(createAdminClient(), user.id)

    if (profileError) {
      console.error('[Checkout] Profile lookup/create error:', profileError)
      return NextResponse.json({ error: 'Profile unavailable' }, { status: 500 })
    }

    console.log('[Checkout] Creating Stripe session...')

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${pack.charAt(0).toUpperCase() + pack.slice(1)} Pack`,
              description: `${selectedPack.credits} credits for Havdolo`,
            },
            unit_amount: selectedPack.price,
          },
          quantity: 1,
        },
      ],
      success_url: `${request.headers.get('origin')}/credits?success=true`,
      cancel_url: `${request.headers.get('origin')}/credits`,
      metadata: {
        userId: user.id,
        creditsToAdd: selectedPack.credits.toString(),
        pack,
      },
    })

    console.log('[Checkout] Stripe session created:', session.id)

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('[Checkout] Stripe checkout error:', error.message, error)
    return NextResponse.json({ error: error.message || 'Checkout failed' }, { status: 500 })
  }
}
