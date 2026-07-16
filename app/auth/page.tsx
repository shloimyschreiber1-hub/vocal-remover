'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRightIcon, GoogleIcon } from '@/components/icons'
import { SiteFooter } from '@/components/SiteFooter'

function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'error' | 'success'>('error')

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      setMessageType('error')
      setMessage(error)
    }
  }, [searchParams])

  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (error: any) {
      setMessageType('error')
      setMessage(error.message || 'Failed to sign in with Google')
      setGoogleLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) throw error

        setMessageType('success')
        setMessage('Account created successfully! Redirecting...')

        await new Promise(resolve => setTimeout(resolve, 1500))

        router.push('/')
        router.refresh()
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        console.log('Signed in:', data.user?.id)

        setMessageType('success')
        setMessage('Signed in successfully! Redirecting...')

        await new Promise(resolve => setTimeout(resolve, 1500))

        router.push('/')
        router.refresh()
      }
    } catch (error: any) {
      setMessageType('error')
      setMessage(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const busy = loading || googleLoading

  return (
    <div className="border border-white/10 rounded-lg p-8 bg-[#141414]">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {isSignUp ? 'Create account' : 'Sign in'}
      </h1>

      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={busy}
        className={`
          flex w-full items-center justify-center gap-3 px-6 py-3.5 sm:py-3
          bg-white text-[#1f1f1f] rounded-md font-medium
          transition-colors
          ${busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/90 active:bg-white/85'}
        `}
      >
        <GoogleIcon width={18} height={18} />
        {googleLoading ? 'Redirecting...' : 'Continue with Google'}
      </button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="bg-[#141414] px-3 text-white/40">or</span>
        </div>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm text-white/60 mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-[#080808] border border-white/20 rounded-md focus:outline-none focus:border-[#4d7cff] transition-colors"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm text-white/60 mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 bg-[#080808] border border-white/20 rounded-md focus:outline-none focus:border-[#4d7cff] transition-colors"
          />
        </div>

        {message && (
          <div className={`
            p-3 border rounded-md text-sm
            ${messageType === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-white/5 border-white/10 text-white/90'
            }
          `}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className={`
            flex w-full items-center justify-center gap-2 px-6 py-3.5 sm:py-3 bg-[#4d7cff] text-white rounded-md font-medium
            transition-colors
            ${busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#3f6cf5] active:bg-[#3f6cf5]'}
          `}
        >
          {loading ? 'Loading...' : isSignUp ? 'Sign up' : 'Sign in'}
          {!loading && <ArrowRightIcon width={17} height={17} />}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => {
            setIsSignUp(!isSignUp)
            setMessage('')
            setMessageType('error')
          }}
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="hover:opacity-80 transition-opacity inline-block">
              <img src="/logo-gradient.svg" alt="Havdolo" className="h-9 w-auto" />
            </Link>
          </div>

          <Suspense
            fallback={
              <div className="border border-white/10 rounded-lg p-8 bg-[#141414] text-center text-white/40">
                Loading...
              </div>
            }
          >
            <AuthForm />
          </Suspense>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
