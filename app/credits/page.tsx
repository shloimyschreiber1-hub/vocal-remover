'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Database } from '@/lib/database.types'
import { SparklesIcon, CheckIcon, ZapIcon, PlusIcon } from '@/components/icons'

type Profile = Database['public']['Tables']['profiles']['Row']

const PACKS = [
  { id: 'starter', credits: 1, price: 4.99 },
  { id: 'producer', credits: 3, price: 0.10, highlight: true },
  { id: 'studio', credits: 10, price: 25.99 },
]

function CreditsContent() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadingPack, setLoadingPack] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      try {
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
      } finally {
        setPageLoading(false)
      }
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError)
        throw new Error('Please sign in again')
      }

      console.log('Starting checkout for pack:', packId)

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pack: packId }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error('Checkout failed:', data)
        throw new Error(data.error || 'Checkout failed')
      }

      console.log('Redirecting to Stripe:', data.url)
      window.location.href = data.url
    } catch (err: any) {
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
    <div className="relative min-h-screen overflow-hidden bg-[#080808] text-white text-sm">
      {/* Ambient glow */}
      <div className="glow-blob" style={{ width: 460, height: 460, top: -160, left: '50%', marginLeft: -230 }} />

      <nav className="relative z-20 px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <img src="/logo-gradient.svg" alt="Havdolo" className="h-8 sm:h-9 w-auto" />
          </Link>

          {user && !pageLoading && (
            <Link
              href="/profile"
              className="flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 h-[42px] rounded-lg hover:bg-white/5 transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4d7cff] to-[#6b93ff] flex items-center justify-center text-sm font-bold shadow-lg">
                {user.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold tabular-nums text-[#ff8c42]">{profile?.credits ?? 0}</span>
                <span className="text-sm font-medium text-white/60">credits</span>
              </div>
            </Link>
          )}
        </div>
      </nav>

      {pageLoading ? (
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-20 text-center">
          <div className="animate-pulse">
            <div className="h-8 w-32 bg-white/10 rounded mx-auto mb-6"></div>
            <div className="h-16 w-64 bg-white/10 rounded mx-auto mb-4"></div>
            <div className="h-4 w-96 bg-white/10 rounded mx-auto"></div>
          </div>
        </div>
      ) : (
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-20">
        {/* Hero Section */}
        <div className="text-center mb-12 sm:mb-16">
          <p className="animate-fade-in-up inline-flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-[#6b93ff]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4d7cff] animate-pulse-soft" />
            Pricing
          </p>
          <h1 className="mt-6 animate-fade-in-up delay-100 text-4xl sm:text-6xl font-bold leading-[1.03] tracking-tight">
            Top up your <span className="shimmer-text">credits</span>.
          </h1>
          <p className="mt-4 sm:mt-6 animate-fade-in-up delay-200 text-sm text-white/55 max-w-xl mx-auto leading-relaxed px-4">
            One credit covers up to 6 minutes of audio. No subscriptions, no recurring charges.
          </p>
        </div>

        {/* Current Balance */}
        {profile && (
          <div className="mb-8 sm:mb-10 mx-auto max-w-md rounded-2xl p-px bg-gradient-to-br from-white/15 to-white/[0.03]">
            <div className="rounded-2xl bg-[#0a0a0a] px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-white/50">Current balance</span>
              <span className="text-lg font-bold tabular-nums">
                <span className="text-[#ff8c42]">{profile.credits}</span>{' '}
                <span className="text-white/60 font-medium">{profile.credits === 1 ? 'credit' : 'credits'}</span>
              </span>
            </div>
          </div>
        )}

        {searchParams.get('success') === 'true' && (
          <div className="mb-8 mx-auto max-w-md p-4 rounded-lg border border-[#4d7cff]/25 bg-[#4d7cff]/10 text-center">
            <p className="text-white">Payment successful. Your credits have been added.</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 mb-12 sm:mb-16 pt-5">
          {PACKS.map((pack, index) => (
            <div
              key={pack.id}
              className={`
                group relative rounded-2xl p-px transition-all animate-fade-in-up
                ${
                  pack.highlight
                    ? 'bg-gradient-to-br from-[#4d7cff] to-[#4d7cff]/20 shadow-xl shadow-[#4d7cff]/20'
                    : 'bg-gradient-to-br from-white/15 to-white/[0.03] hover:from-white/25'
                }
              `}
              style={{ animationDelay: `${index * 100 + 200}ms` }}
            >
              {pack.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-3 sm:px-4 py-1 rounded-full bg-[#4d7cff] text-white text-xs font-bold uppercase tracking-wide shadow-lg whitespace-nowrap">
                  Most popular
                </span>
              )}
              <div className="relative rounded-2xl bg-[#0a0a0a] p-6 sm:p-8 overflow-hidden">
                <div className="text-center mb-6">
                  <div className="flex items-baseline justify-center gap-2 mb-1">
                    <span className="text-5xl sm:text-6xl font-bold tabular-nums leading-none">{pack.credits}</span>
                    <span className="text-base font-medium text-white/50">{pack.credits === 1 ? 'credit' : 'credits'}</span>
                  </div>
                  <div className="text-xs text-white/40 mb-5">
                    {pack.credits === 1 ? 'up to 6 min of audio' : `up to ${pack.credits * 6} min of audio`}
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold mb-1.5 text-[#6b93ff]">${pack.price.toFixed(2)}</div>
                  <div className="text-xs text-white/40">
                    ${(pack.price / pack.credits).toFixed(2)} per credit
                  </div>
                </div>

                <button
                  onClick={() => handleBuyPack(pack.id)}
                  disabled={loadingPack === pack.id}
                  className={`
                    flex w-full items-center justify-center gap-2 px-6 py-3.5 sm:py-3 rounded-lg font-semibold transition-all
                    ${
                      pack.highlight
                        ? 'bg-[#4d7cff] text-white hover:bg-[#3f6cf5] hover:scale-[1.02] active:scale-[0.99]'
                        : 'bg-white/5 text-white hover:bg-white/10 active:bg-white/10'
                    }
                    ${loadingPack === pack.id ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {loadingPack !== pack.id && error !== pack.id && (
                    <PlusIcon width={17} height={17} />
                  )}
                  {getButtonText(pack.id)}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Section divider */}
        <div className="section-divider mb-12 sm:mb-16" aria-hidden="true">
          <span className="section-divider__dot" />
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-3 gap-8 sm:gap-12 mb-16">
          {[
            { icon: SparklesIcon, t: 'High quality', d: 'Studio-grade vocal separation powered by AI.' },
            { icon: CheckIcon, t: 'No subscription', d: 'Pay once, use anytime. Credits never expire.' },
            { icon: ZapIcon, t: 'Instant processing', d: 'Get your separated tracks in minutes.' },
          ].map((feature) => (
            <div key={feature.t} className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#4d7cff]/15 text-[#6b93ff] flex items-center justify-center mx-auto mb-4">
                <feature.icon width={22} height={22} />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.t}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{feature.d}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="inline-block px-8 py-3 border border-white/15 rounded-lg font-medium hover:border-white/40 hover:bg-white/5 transition-all"
          >
            Back to home
          </Link>
        </div>
      </main>
      )}
    </div>
  )
}

export default function CreditsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080808]" />}>
      <CreditsContent />
    </Suspense>
  )
}
