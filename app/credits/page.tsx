'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Database } from '@/lib/database.types'
import { SparklesIcon, CheckIcon, ZapIcon } from '@/components/icons'

type Profile = Database['public']['Tables']['profiles']['Row']

const PACKS = [
  { id: 'starter', name: 'Starter', credits: 10, price: 9.99 },
  { id: 'producer', name: 'Producer', credits: 50, price: 39.99, highlight: true },
  { id: 'studio', name: 'Studio', credits: 150, price: 99.99 },
]

function CreditsContent() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadingPack, setLoadingPack] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      setUser(user)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profileData)
    }

    loadProfile()

    if (searchParams.get('success') === 'true') {
      loadProfile()
    }
  }, [searchParams])

  const handleBuyPack = async (packId: string) => {
    setLoadingPack(packId)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ pack: packId }),
      })

      if (!response.ok) {
        throw new Error('Checkout failed')
      }

      const data = await response.json()
      window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
      setError(packId)
      setLoadingPack(null)
      setTimeout(() => setError(null), 3000)
    }
  }

  const getButtonText = (packId: string) => {
    if (loadingPack === packId) return 'Redirecting...'
    if (error === packId) return 'Try again'
    return 'Buy'
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      <nav className="px-4 sm:px-6 py-4 sm:py-6 sticky top-0 z-50 bg-[#0e0e0e]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl sm:text-2xl font-bold tracking-tight hover:text-[#4d7cff] transition-colors">
            Havdolo
          </Link>

          {user && (
            <Link
              href="/profile"
              className="flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 h-[42px] rounded-lg hover:bg-white/5 transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4d7cff] to-[#6b93ff] flex items-center justify-center text-sm font-bold shadow-lg">
                {user.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold tabular-nums text-[#ff8c42]">{profile?.credits ?? 0}</span>
                <span className="text-xs font-medium text-white/60">credits</span>
              </div>
            </Link>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Hero Section */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-[#4d7cff]/10 border border-[#4d7cff]/20 mb-4 sm:mb-6">
            <span className="text-xs sm:text-sm font-medium text-[#4d7cff]">PRICING</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-3 sm:mb-4 px-4">Choose your plan</h1>
          <p className="text-base sm:text-xl text-white/60 max-w-2xl mx-auto px-4">
            One credit covers up to 6 minutes of audio. No subscriptions, no recurring charges.
          </p>
        </div>

        {/* Current Balance */}
        {profile && (
          <div className="mb-12 p-6 rounded-lg bg-gradient-to-r from-[#4d7cff]/10 to-[#6b93ff]/10 border border-[#4d7cff]/20 text-center">
            <div className="text-sm text-white/60 mb-1">Current Balance</div>
            <div className="text-3xl font-bold tabular-nums">{profile.credits} {profile.credits === 1 ? 'credit' : 'credits'}</div>
          </div>
        )}

        {searchParams.get('success') === 'true' && (
          <div className="mb-8 p-4 border border-white/20 rounded-lg bg-white/5">
            <p className="text-white">Payment successful. Your credits have been added.</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-16">
          {PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`
                relative rounded-lg p-6 sm:p-8 border transition-all
                ${pack.highlight 
                  ? 'border-[#4d7cff] bg-gradient-to-b from-[#4d7cff]/10 to-transparent' 
                  : 'border-white/10 bg-[#161616]'}
              `}
            >
              {pack.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-[#4d7cff] text-white text-xs font-bold uppercase tracking-wide">
                  Most popular
                </span>
              )}
              <div className="text-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-3">{pack.name}</h2>
                <div className="mb-4">
                  <div className="text-4xl sm:text-5xl font-bold mb-2">£{pack.price.toFixed(2)}</div>
                  <div className="text-sm sm:text-base text-white/60">{pack.credits} credits</div>
                </div>
                <div className="text-xs sm:text-sm text-white/40">
                  £{(pack.price / pack.credits).toFixed(2)} per 6 min
                </div>
              </div>

              <button
                onClick={() => handleBuyPack(pack.id)}
                disabled={loadingPack === pack.id}
                className={`
                  flex w-full items-center justify-center gap-2 px-6 py-3.5 rounded-lg font-semibold transition-all
                  ${
                    pack.highlight
                      ? 'bg-[#4d7cff] text-white hover:bg-[#3f6cf5]'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }
                  ${loadingPack === pack.id ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {loadingPack !== pack.id && error !== pack.id && (
                  <SparklesIcon width={17} height={17} />
                )}
                {getButtonText(pack.id)}
              </button>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-16 p-8 rounded-lg bg-[#161616] border border-white/10">
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-[#4d7cff]/10 border border-[#4d7cff]/20 flex items-center justify-center mx-auto mb-3 text-[#4d7cff]">
              <SparklesIcon width={22} height={22} />
            </div>
            <h3 className="font-semibold mb-2">High Quality</h3>
            <p className="text-sm text-white/60">Studio-grade vocal separation powered by AI</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-[#4d7cff]/10 border border-[#4d7cff]/20 flex items-center justify-center mx-auto mb-3 text-[#4d7cff]">
              <CheckIcon width={22} height={22} />
            </div>
            <h3 className="font-semibold mb-2">No Subscription</h3>
            <p className="text-sm text-white/60">Pay once, use anytime. Credits never expire</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-[#4d7cff]/10 border border-[#4d7cff]/20 flex items-center justify-center mx-auto mb-3 text-[#4d7cff]">
              <ZapIcon width={22} height={22} />
            </div>
            <h3 className="font-semibold mb-2">Instant Processing</h3>
            <p className="text-sm text-white/60">Get your separated tracks in minutes</p>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="inline-block px-8 py-3 border border-white/20 rounded-lg font-medium hover:border-white/40 hover:bg-white/5 transition-all"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function CreditsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0e0e0e]" />}>
      <CreditsContent />
    </Suspense>
  )
}
