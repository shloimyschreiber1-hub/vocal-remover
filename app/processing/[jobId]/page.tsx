'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { Database } from '@/lib/database.types'
import { AlertTriangleIcon } from '@/components/icons'

type Job = Database['public']['Tables']['jobs']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

const STEPS = [
  { key: 'uploaded', label: 'Uploaded', sub: 'Your track is in' },
  { key: 'analysing', label: 'Analysing', sub: 'Reading the frequency data' },
  { key: 'separating', label: 'Separating', sub: 'Isolating vocals and music' },
  { key: 'exporting', label: 'Exporting', sub: 'Preparing your files' },
]

export default function ProcessingPage() {
  const [job, setJob] = useState<Job | null>(null)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(false)
  const router = useRouter()
  const params = useParams()
  const jobId = params.jobId as string
  const supabase = createClient()

  useEffect(() => {
    async function checkJob() {
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

      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (!jobData || jobData.user_id !== user.id) {
        router.push('/')
        return
      }

      setJob(jobData)
    }

    checkJob()
  }, [jobId])

  useEffect(() => {
    if (!job) return

    const pollStatus = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        const response = await fetch(`/api/job/${jobId}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
        if (!response.ok) return

        const data = await response.json()

        if (data.status === 'failed') {
          setError(true)
          return
        }

        if (data.status === 'done') {
          setProgress(100)
          setCurrentStep(4)
          setTimeout(() => router.push(`/results/${jobId}`), 600)
          return
        }

        const statusMap: Record<string, number> = {
          pending: 1,
          analysing: 2,
          separating: 3,
          exporting: 4,
        }

        setCurrentStep(statusMap[data.status] || 1)
        if (typeof data.progress === 'number' && data.progress > 0) {
          setProgress(data.progress)
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }

    pollStatus()
    const interval = setInterval(pollStatus, 3000)
    return () => clearInterval(interval)
  }, [job, jobId, router])

  if (!job) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="text-white/40 animate-pulse-soft">Loading…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white">
        <nav className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="max-w-5xl mx-auto">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <img src="/logo-gradient.svg" alt="Havdolo" className="h-8 sm:h-9 w-auto" />
            </Link>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 animate-fade-in-up">
          <div className="p-12 rounded-lg bg-gradient-to-br from-[#161616] to-[#0e0e0e] border border-white/10 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertTriangleIcon width={32} height={32} />
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
            <p className="text-white/60 text-lg mb-8">Your credit has been refunded. Please try again.</p>
            <Link
              href="/"
              className="inline-block px-8 py-4 bg-[#4d7cff] text-white rounded-lg font-semibold hover:bg-[#3f6cf5] transition-colors"
            >
              Back to home
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // Blend step position with reported progress for a smoother bar
  const stepFraction = (currentStep - 1) / STEPS.length
  const barProgress = Math.max(
    stepFraction * 100,
    Math.min(100, (stepFraction + progress / 100 / STEPS.length) * 100)
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0e0e0e] text-white">
      <div className="glow-blob" style={{ width: 360, height: 360, top: 40, left: -80 }} />
      <div
        className="glow-blob"
        style={{ width: 320, height: 320, bottom: 0, right: -80, animationDelay: '2s' }}
      />

      <nav className="relative z-10 px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <img src="/logo-gradient.svg" alt="Havdolo" className="h-8 sm:h-9 w-auto" />
          </Link>

          {user && profile && (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 h-[42px] rounded-lg hover:bg-white/5 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4d7cff] to-[#6b93ff] flex items-center justify-center text-sm font-bold shadow-lg">
                  {user.email?.[0].toUpperCase() || 'U'}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-bold tabular-nums text-[#ff8c42]">{profile.credits ?? 0}</span>
                  <span className="text-xs font-medium text-white/60">credits</span>
                </div>
              </Link>
              <Link
                href="/credits"
                className="px-5 sm:px-6 h-[42px] flex items-center rounded-lg bg-[#4d7cff] text-white text-sm font-semibold hover:bg-[#3f6cf5] transition-all hover:scale-[1.02] whitespace-nowrap"
              >
                <span className="hidden sm:inline">Get credits</span>
                <span className="sm:hidden">Credits</span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="mb-8 sm:mb-12 p-6 sm:p-8 rounded-lg bg-gradient-to-br from-[#161616] to-[#0e0e0e] border border-white/10 animate-fade-in-up">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#4d7cff] animate-pulse" />
            <span className="text-xs sm:text-sm font-medium text-[#4d7cff]">PROCESSING</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2">Separating your track</h1>
          <p className="text-white/60 text-sm sm:text-lg truncate">{job.original_filename}</p>
        </div>

        <div className="mb-12 p-6 rounded-lg bg-[#161616] border border-white/10 animate-fade-in-up delay-100">
          <div className="flex justify-between text-sm mb-3">
            <span className="font-medium">{STEPS[Math.min(currentStep - 1, 3)].label}…</span>
            <span className="tabular-nums font-semibold text-[#4d7cff]">{Math.round(barProgress)}%</span>
          </div>
          <div className="h-3 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4d7cff] to-[#6b93ff] transition-all duration-700 ease-out"
              style={{ width: `${barProgress}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          {STEPS.map((step, index) => {
            const stepNumber = index + 1
            const isDone = currentStep > stepNumber
            const isActive = currentStep === stepNumber
            const isPending = currentStep < stepNumber

            return (
              <div key={step.key} className="flex gap-4 animate-fade-in-up" style={{ animationDelay: `${index * 80 + 150}ms` }}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all duration-500 ${
                      isDone ? 'border-[#4d7cff] bg-[#4d7cff] text-white' : ''
                    } ${isActive ? 'border-[#4d7cff] text-[#6b93ff] scale-110' : ''} ${
                      isPending ? 'border-white/20 text-white/20' : ''
                    }`}
                  >
                    {isDone ? '✓' : stepNumber}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-0.5 flex-1 mt-2 transition-colors duration-500 ${
                        currentStep > stepNumber ? 'bg-[#4d7cff]' : 'bg-white/15'
                      }`}
                      style={{ minHeight: '44px' }}
                    />
                  )}
                </div>

                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-3">
                    <p
                      className={`font-medium transition-colors ${
                        isDone || isActive ? 'text-white' : 'text-white/40'
                      }`}
                    >
                      {step.label}
                    </p>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4d7cff] animate-pulse-soft" />
                    )}
                  </div>
                  <p
                    className={`text-sm mt-0.5 transition-colors ${
                      isActive ? 'text-white/60' : 'text-white/30'
                    }`}
                  >
                    {step.sub}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
