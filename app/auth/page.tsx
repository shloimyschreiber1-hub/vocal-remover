'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRightIcon } from '@/components/icons'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  const router = useRouter()
  const supabase = createClient()

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
        setMessage('Check your email to confirm your account')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
        
        console.log('Signed in:', data.user?.id)
        
        // Wait a moment for cookies to be set
        await new Promise(resolve => setTimeout(resolve, 100))
        
        router.push('/')
        router.refresh()
      }
    } catch (error: any) {
      setMessage(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="hover:opacity-80 transition-opacity inline-block">
            <img src="/logo-gradient.svg" alt="Havdolo" className="h-9 w-auto" />
          </Link>
        </div>

        <div className="border border-white/10 rounded-lg p-8 bg-[#1a1a1a]">
          <h1 className="text-2xl font-bold mb-6 text-center">
            {isSignUp ? 'Create account' : 'Sign in'}
          </h1>

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
                className="w-full px-4 py-3 bg-[#0e0e0e] border border-white/20 rounded-md focus:outline-none focus:border-[#4d7cff] transition-colors"
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
                className="w-full px-4 py-3 bg-[#0e0e0e] border border-white/20 rounded-md focus:outline-none focus:border-[#4d7cff] transition-colors"
              />
            </div>

            {message && (
              <div className="p-3 bg-white/5 border border-white/10 rounded-md text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`
                flex w-full items-center justify-center gap-2 px-6 py-3 bg-[#4d7cff] text-white rounded-md font-medium
                transition-colors
                ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#3f6cf5]'}
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
              }}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

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
  )
}
