'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Database } from '@/lib/database.types'
import { useAuth } from '@/app/contexts/AuthContext'
import {
  ArrowRightIcon,
  ZapIcon,
  MusicIcon,
  CheckIcon,
  UploadIcon,
  FolderIcon,
} from '@/components/icons'

type Job = Database['public']['Tables']['jobs']['Row']

type Filter = 'all' | 'ready' | 'processing'

function formatDate(value: string | null) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function ProfilePage() {
  const { user, profile, loading } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
      return
    }

    // Load jobs asynchronously without blocking render
    if (user) {
      // Load fewer jobs initially for faster first paint, then load more
      supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10) // Load 10 first for speed
        .then(({ data }) => {
          if (data) setJobs(data)
          
          // Then load the rest in background
          if (data && data.length === 10) {
            supabase
              .from('jobs')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(50)
              .then(({ data: allJobs }) => {
                if (allJobs) setJobs(allJobs)
              })
          }
        })
        .catch(err => console.error('Failed to load jobs:', err))
    }
  }, [user, loading])

  const doneCount = useMemo(() => jobs.filter((j) => j.status === 'done').length, [jobs])
  const processingCount = useMemo(
    () => jobs.filter((j) => j.status !== 'done' && j.status !== 'failed').length,
    [jobs]
  )

  const filteredJobs = useMemo(() => {
    if (filter === 'ready') return jobs.filter((j) => j.status === 'done')
    if (filter === 'processing')
      return jobs.filter((j) => j.status !== 'done' && j.status !== 'failed')
    return jobs
  }, [jobs, filter])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/40 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#4d7cff] animate-pulse-soft" />
          Loading your studio…
        </div>
      </div>
    )
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: jobs.length },
    { key: 'ready', label: 'Ready', count: doneCount },
    { key: 'processing', label: 'Processing', count: processingCount },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080808] text-white">
      {/* Ambient glow */}
      <div
        className="glow-blob"
        style={{ width: 460, height: 460, top: -180, left: '50%', marginLeft: -230 }}
      />

      {/* Top Nav */}
      <nav className="relative z-50 px-4 sm:px-6 py-4 sm:py-6 sticky top-0 bg-transparent">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="hover:opacity-80 transition-opacity"
          >
            <img src="/logo-gradient.svg" alt="Havdolo" className="h-8 sm:h-9 w-auto" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 h-[42px] rounded-lg bg-white/[0.04]">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4d7cff] to-[#6b93ff] flex items-center justify-center text-sm font-bold shadow-lg">
                {user?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold tabular-nums text-[#ff8c42]">
                  {profile?.credits ?? 0}
                </span>
                <span className="text-xs font-medium text-white/60">credits</span>
              </div>
            </div>
            <Link
              href="/credits"
              className="px-5 sm:px-6 h-[42px] flex items-center rounded-lg bg-[#4d7cff] text-white text-sm font-semibold hover:bg-[#3f6cf5] transition-all hover:scale-[1.02] whitespace-nowrap"
            >
              <span className="hidden sm:inline">Get credits</span>
              <span className="sm:hidden">Credits</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Profile Header */}
        <div className="animate-fade-in-up flex flex-col sm:flex-row items-center gap-5 sm:gap-6 mb-10 sm:mb-12">
          <div className="relative shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#4d7cff] to-[#6b93ff] flex items-center justify-center text-3xl sm:text-4xl font-bold ring-4 ring-[#4d7cff]/15 shadow-xl shadow-[#4d7cff]/20">
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#4d7cff] ring-4 ring-[#080808]" />
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <p className="text-sm uppercase tracking-[0.25em] text-[#6b93ff] mb-1.5">
              Your studio
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">
              Welcome back
            </h1>
            <p className="text-white/50 text-sm truncate max-w-full">{user?.email}</p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/')
              router.refresh()
            }}
            className="px-5 py-2.5 border border-white/15 rounded-lg font-medium text-sm hover:border-white/40 hover:bg-white/5 transition-all whitespace-nowrap"
          >
            Sign out
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-5 mb-12 sm:mb-16">
          {/* Credits */}
          <Link
            href="/credits"
            className="animate-fade-in-up delay-100 group relative rounded-2xl p-px bg-gradient-to-br from-[#ff8c42]/40 to-white/[0.04] hover:from-[#ff8c42]/70 transition-all"
          >
            <div className="relative h-full rounded-2xl bg-[#0c0c0c] p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm text-white/45">Credits balance</span>
                <span className="w-9 h-9 rounded-lg bg-[#ff8c42]/10 text-[#ff8c42] flex items-center justify-center">
                  <ZapIcon width={18} height={18} />
                </span>
              </div>
              <div className="text-4xl font-bold tabular-nums mb-4 text-[#ff8c42]">
                {profile?.credits ?? 0}
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm text-white/60 group-hover:text-[#ff8c42] transition-colors font-medium">
                Buy more credits
                <ArrowRightIcon
                  width={14}
                  height={14}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </span>
            </div>
          </Link>

          {/* Total tracks */}
          <Link
            href="/"
            className="animate-fade-in-up delay-200 group relative rounded-2xl p-px bg-gradient-to-br from-[#4d7cff]/40 to-white/[0.04] hover:from-[#4d7cff]/70 transition-all"
          >
            <div className="relative h-full rounded-2xl bg-[#0c0c0c] p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm text-white/45">Total tracks</span>
                <span className="w-9 h-9 rounded-lg bg-[#4d7cff]/10 text-[#6b93ff] flex items-center justify-center">
                  <MusicIcon width={18} height={18} />
                </span>
              </div>
              <div className="text-4xl font-bold tabular-nums mb-4">{jobs.length}</div>
              <span className="inline-flex items-center gap-1.5 text-sm text-white/60 group-hover:text-[#6b93ff] transition-colors font-medium">
                Upload new track
                <ArrowRightIcon
                  width={14}
                  height={14}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </span>
            </div>
          </Link>

          {/* Completed */}
          <div className="animate-fade-in-up delay-300 relative rounded-2xl p-px bg-gradient-to-br from-white/15 to-white/[0.04]">
            <div className="relative h-full rounded-2xl bg-[#0c0c0c] p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm text-white/45">Completed</span>
                <span className="w-9 h-9 rounded-lg bg-white/5 text-white/70 flex items-center justify-center">
                  <CheckIcon width={18} height={18} />
                </span>
              </div>
              <div className="text-4xl font-bold tabular-nums mb-4">{doneCount}</div>
              <span className="inline-flex items-center gap-2 text-sm text-white/60 font-medium">
                {processingCount > 0 ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4d7cff] animate-pulse-soft" />
                    {processingCount} processing
                  </>
                ) : (
                  'All caught up'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Tracks */}
        <section className="animate-fade-in-up delay-400">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
                Your tracks
              </h2>
              <p className="text-white/50 text-sm">All your separated tracks in one place</p>
            </div>

            {jobs.length > 0 && (
              <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] self-start sm:self-auto">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      filter === f.key
                        ? 'bg-[#4d7cff] text-white'
                        : 'text-white/55 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {f.label}
                    <span
                      className={`ml-1.5 tabular-nums ${
                        filter === f.key ? 'text-white/80' : 'text-white/35'
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {jobs.length === 0 ? (
            <div className="relative rounded-2xl border border-dashed border-white/15 p-12 sm:p-16 text-center">
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-full bg-[#4d7cff]/15 text-[#6b93ff] flex items-center justify-center">
                  <UploadIcon width={26} height={26} />
                </div>
              </div>
              <p className="text-lg font-medium mb-1">No tracks yet</p>
              <p className="text-white/40 text-sm mb-6">
                Upload your first track to get started with vocal separation.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#4d7cff] text-white rounded-lg font-medium hover:bg-[#3f6cf5] transition-all hover:scale-[1.02]"
              >
                Upload your first track
                <ArrowRightIcon width={16} height={16} />
              </Link>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 p-12 text-center text-white/40">
              <FolderIcon width={28} height={28} className="mx-auto mb-3 opacity-50" />
              No {filter} tracks.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredJobs.map((job) => {
                const isDone = job.status === 'done'
                const isFailed = job.status === 'failed'
                const isProcessing = !isDone && !isFailed

                return (
                  <div
                    key={job.id}
                    className="group relative rounded-xl border border-white/10 bg-[#0c0c0c] p-4 flex items-center justify-between gap-4 hover:border-white/25 hover:bg-white/[0.03] transition-all"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          isDone
                            ? 'bg-[#4d7cff]/10 text-[#6b93ff]'
                            : isFailed
                              ? 'bg-white/5 text-white/30'
                              : 'bg-[#4d7cff]/10 text-[#6b93ff]'
                        }`}
                      >
                        <MusicIcon width={18} height={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{job.original_filename}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                              isDone
                                ? 'text-[#6b93ff]'
                                : isFailed
                                  ? 'text-white/35'
                                  : 'text-[#6b93ff]'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isDone
                                  ? 'bg-[#4d7cff]'
                                  : isFailed
                                    ? 'bg-white/30'
                                    : 'bg-[#4d7cff] animate-pulse-soft'
                              }`}
                            />
                            {isDone ? 'Ready' : isFailed ? 'Failed' : 'Processing'}
                          </span>
                          {job.created_at && (
                            <>
                              <span className="text-white/15">·</span>
                              <span className="text-xs text-white/35">
                                {formatDate(job.created_at)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isDone ? (
                      <Link
                        href={`/results/${job.id}`}
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-white/5 rounded-lg text-sm font-medium hover:bg-[#4d7cff] transition-colors"
                      >
                        Open
                        <ArrowRightIcon
                          width={15}
                          height={15}
                          className="group-hover:translate-x-0.5 transition-transform"
                        />
                      </Link>
                    ) : isProcessing ? (
                      <Link
                        href={`/processing/${job.id}`}
                        className="shrink-0 px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
                      >
                        View progress
                      </Link>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
