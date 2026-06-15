'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import WaveSurfer from 'wavesurfer.js'
import type { Database } from '@/lib/database.types'
import {
  PlayIcon,
  PauseIcon,
  DownloadIcon,
  CheckIcon,
  MicIcon,
  MusicIcon,
  PlusIcon,
  FolderIcon,
  ZapIcon,
  UploadIcon,
  LinkIcon,
  SparklesIcon,
} from '@/components/icons'

type Profile = Database['public']['Tables']['profiles']['Row']

// Only the public-safe subset of a job is needed to render the shared page.
type PublicJob = {
  status: string
  original_filename: string
  vocal_url: string | null
  instrumental_url: string | null
}

export default function ResultsPage() {
  const [job, setJob] = useState<PublicJob | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [vocalsPlaying, setVocalsPlaying] = useState(false)
  const [instrumentalPlaying, setInstrumentalPlaying] = useState(false)
  const [vocalsDownloaded, setVocalsDownloaded] = useState(false)
  const [instrumentalDownloaded, setInstrumentalDownloaded] = useState(false)
  const [bothDownloaded, setBothDownloaded] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const vocalsWaveformRef = useRef<HTMLDivElement>(null)
  const instrumentalWaveformRef = useRef<HTMLDivElement>(null)
  const vocalsWaveSurferRef = useRef<WaveSurfer | null>(null)
  const instrumentalWaveSurferRef = useRef<WaveSurfer | null>(null)

  const params = useParams()
  const jobId = params.jobId as string
  const supabase = createClient()

  useEffect(() => {
    async function loadJob() {
      // The results page is public so links can be shared, but if the visitor
      // happens to be signed in we still show their account nav + credits.
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUser(user)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(profileData)
      }

      try {
        const res = await fetch(`/api/public/job/${jobId}`)
        if (!res.ok) {
          setNotFound(true)
          return
        }
        const jobData = (await res.json()) as PublicJob
        setJob(jobData)
      } catch {
        setNotFound(true)
      }
    }

    loadJob()
  }, [jobId])

  useEffect(() => {
    if (!job || !job.vocal_url || !job.instrumental_url) return

    if (vocalsWaveformRef.current && !vocalsWaveSurferRef.current) {
      vocalsWaveSurferRef.current = WaveSurfer.create({
        container: vocalsWaveformRef.current,
        waveColor: '#3a3a3a',
        progressColor: '#4d7cff',
        cursorColor: '#6b93ff',
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        height: 110,
        normalize: true,
      })

      vocalsWaveSurferRef.current.load(job.vocal_url).catch((e: any) => {
        if (e?.name !== 'AbortError') console.error('Vocals load error:', e)
      })

      vocalsWaveSurferRef.current.on('play', () => {
        setVocalsPlaying(true)
        if (instrumentalWaveSurferRef.current?.isPlaying()) {
          instrumentalWaveSurferRef.current.pause()
        }
      })

      vocalsWaveSurferRef.current.on('pause', () => {
        setVocalsPlaying(false)
      })

      vocalsWaveSurferRef.current.on('finish', () => {
        setVocalsPlaying(false)
      })
    }

    if (instrumentalWaveformRef.current && !instrumentalWaveSurferRef.current) {
      instrumentalWaveSurferRef.current = WaveSurfer.create({
        container: instrumentalWaveformRef.current,
        waveColor: '#3a3a3a',
        progressColor: '#4d7cff',
        cursorColor: '#6b93ff',
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        height: 110,
        normalize: true,
      })

      instrumentalWaveSurferRef.current.load(job.instrumental_url).catch((e: any) => {
        if (e?.name !== 'AbortError') console.error('Music load error:', e)
      })

      instrumentalWaveSurferRef.current.on('play', () => {
        setInstrumentalPlaying(true)
        if (vocalsWaveSurferRef.current?.isPlaying()) {
          vocalsWaveSurferRef.current.pause()
        }
      })

      instrumentalWaveSurferRef.current.on('pause', () => {
        setInstrumentalPlaying(false)
      })

      instrumentalWaveSurferRef.current.on('finish', () => {
        setInstrumentalPlaying(false)
      })
    }

    return () => {
      try {
        vocalsWaveSurferRef.current?.destroy()
      } catch {}
      try {
        instrumentalWaveSurferRef.current?.destroy()
      } catch {}
      vocalsWaveSurferRef.current = null
      instrumentalWaveSurferRef.current = null
    }
  }, [job])

  const toggleVocalsPlayback = () => {
    vocalsWaveSurferRef.current?.playPause()
  }

  const toggleInstrumentalPlayback = () => {
    instrumentalWaveSurferRef.current?.playPause()
  }

  const downloadFile = async (url: string, filename: string, setDownloaded: (val: boolean) => void) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
      setDownloaded(true)
      setTimeout(() => setDownloaded(false), 3000)
    } catch (error) {
      console.error('Download error:', error)
    }
  }

  const downloadBoth = async () => {
    const vocalUrl = job?.vocal_url
    const instrumentalUrl = job?.instrumental_url
    if (!job || !vocalUrl || !instrumentalUrl) return

    const vocalsFilename = job.original_filename.replace(/\.[^/.]+$/, '_vocals.mp3')
    const instrumentalFilename = job.original_filename.replace(/\.[^/.]+$/, '_music.mp3')

    await downloadFile(vocalUrl, vocalsFilename, () => {})
    setTimeout(async () => {
      await downloadFile(instrumentalUrl, instrumentalFilename, () => {})
      setBothDownloaded(true)
      setTimeout(() => setBothDownloaded(false), 3000)
    }, 500)
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Separation not found</h1>
          <p className="text-white/60 mb-6">
            This link may be invalid or the separation isn&apos;t ready yet.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-[#4d7cff] text-white rounded-lg font-medium hover:bg-[#3f6cf5] transition-colors"
          >
            Separate a track
          </Link>
        </div>
      </div>
    )
  }

  const shareLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Havdolo — separation', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    } catch {
      // user cancelled share or clipboard unavailable — no-op
    }
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    )
  }

  const vocalsFilename = job.original_filename.replace(/\.[^/.]+$/, '_vocals.mp3')
  const instrumentalFilename = job.original_filename.replace(/\.[^/.]+$/, '_music.mp3')

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0e0e0e] text-white">
      {/* Ambient glow */}
      <div
        className="glow-blob"
        style={{ width: 460, height: 460, top: -180, left: '50%', marginLeft: -230 }}
      />

      <nav className="relative z-20 px-4 sm:px-6 py-4 sm:py-6 sticky top-0 bg-transparent">
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
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4d7cff] to-[#6b93ff] flex items-center justify-center text-sm font-bold">
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

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        {/* Success hero */}
        <header className="text-center mb-10 sm:mb-14">
          <div className="flex justify-center mb-5 sm:mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#4d7cff]/30 blur-xl" />
              <div className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-gradient-to-br from-[#4d7cff] to-[#6b93ff] flex items-center justify-center shadow-xl shadow-[#4d7cff]/30">
                <CheckIcon width={32} height={32} className="text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#6b93ff] mb-3 sm:mb-4">
            <SparklesIcon width={14} height={14} />
            Separation complete
          </p>

          <h1 className="text-3xl sm:text-5xl font-bold leading-[1.05] tracking-tight mb-4 sm:mb-5">
            Your tracks are <span className="shimmer-text">ready</span>.
          </h1>

          <div className="inline-flex max-w-full items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10">
            <MusicIcon width={15} height={15} className="text-[#6b93ff] shrink-0" />
            <span className="text-sm text-white/70 truncate">{job.original_filename}</span>
          </div>
        </header>

        {/* Stem player */}
        <div className="rounded-2xl p-px bg-gradient-to-br from-white/15 to-white/[0.03] mb-5 sm:mb-6">
          <div className="rounded-2xl bg-[#101010] divide-y divide-white/[0.06] overflow-hidden">
            {/* Vocals */}
            <div className={`p-5 sm:p-6 transition-colors ${vocalsPlaying ? 'bg-[#4d7cff]/[0.06]' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                <div className="flex items-center gap-3.5 sm:w-52 sm:shrink-0">
                  <button
                    onClick={toggleVocalsPlayback}
                    aria-label={vocalsPlaying ? 'Pause' : 'Play'}
                    className="w-12 h-12 shrink-0 rounded-full bg-[#4d7cff] text-white flex items-center justify-center hover:bg-[#3f6cf5] transition-colors"
                  >
                    {vocalsPlaying ? (
                      <PauseIcon width={20} height={20} />
                    ) : (
                      <PlayIcon width={20} height={20} className="ml-0.5" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MicIcon width={16} height={16} className="text-[#6b93ff] shrink-0" />
                      <h2 className="text-base font-semibold leading-tight">Vocals</h2>
                      {vocalsPlaying && (
                        <span className="flex items-end gap-0.5 h-3.5">
                          {[0, 0.2, 0.4].map((delay, i) => (
                            <span
                              key={i}
                              className="eq-bar h-full"
                              style={{ width: 3, background: '#4d7cff', animationDelay: `${delay}s` }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 truncate mt-0.5">{vocalsFilename}</p>
                  </div>
                </div>

                <div className="flex-1 min-w-0 rounded-lg bg-black/25 px-4 py-3">
                  <div ref={vocalsWaveformRef} className="w-full cursor-pointer" />
                </div>

                <button
                  onClick={() => downloadFile(job.vocal_url!, vocalsFilename, setVocalsDownloaded)}
                  className="flex w-full sm:w-auto sm:shrink-0 items-center justify-center gap-2 px-5 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-sm font-medium hover:bg-white/[0.08] hover:border-white/25 transition-all"
                >
                  {vocalsDownloaded ? (
                    <CheckIcon width={18} height={18} className="text-[#6b93ff]" />
                  ) : (
                    <DownloadIcon width={18} height={18} />
                  )}
                  {vocalsDownloaded ? 'Saved' : 'Download'}
                </button>
              </div>
            </div>

            {/* Music */}
            <div className={`p-5 sm:p-6 transition-colors ${instrumentalPlaying ? 'bg-[#4d7cff]/[0.06]' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                <div className="flex items-center gap-3.5 sm:w-52 sm:shrink-0">
                  <button
                    onClick={toggleInstrumentalPlayback}
                    aria-label={instrumentalPlaying ? 'Pause' : 'Play'}
                    className="w-12 h-12 shrink-0 rounded-full bg-[#4d7cff] text-white flex items-center justify-center hover:bg-[#3f6cf5] transition-colors"
                  >
                    {instrumentalPlaying ? (
                      <PauseIcon width={20} height={20} />
                    ) : (
                      <PlayIcon width={20} height={20} className="ml-0.5" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MusicIcon width={16} height={16} className="text-[#6b93ff] shrink-0" />
                      <h2 className="text-base font-semibold leading-tight">Music</h2>
                      {instrumentalPlaying && (
                        <span className="flex items-end gap-0.5 h-3.5">
                          {[0, 0.2, 0.4].map((delay, i) => (
                            <span
                              key={i}
                              className="eq-bar h-full"
                              style={{ width: 3, background: '#4d7cff', animationDelay: `${delay}s` }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 truncate mt-0.5">{instrumentalFilename}</p>
                  </div>
                </div>

                <div className="flex-1 min-w-0 rounded-lg bg-black/25 px-4 py-3">
                  <div ref={instrumentalWaveformRef} className="w-full cursor-pointer" />
                </div>

                <button
                  onClick={() => downloadFile(job.instrumental_url!, instrumentalFilename, setInstrumentalDownloaded)}
                  className="flex w-full sm:w-auto sm:shrink-0 items-center justify-center gap-2 px-5 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-sm font-medium hover:bg-white/[0.08] hover:border-white/25 transition-all"
                >
                  {instrumentalDownloaded ? (
                    <CheckIcon width={18} height={18} className="text-[#6b93ff]" />
                  ) : (
                    <DownloadIcon width={18} height={18} />
                  )}
                  {instrumentalDownloaded ? 'Saved' : 'Download'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Primary actions */}
        <div className="grid sm:grid-cols-[1.5fr_1fr] gap-3 sm:gap-4 mb-12 sm:mb-16">
          <button
            onClick={downloadBoth}
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-[#4d7cff] to-[#6b93ff] hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            {bothDownloaded ? (
              <CheckIcon width={18} height={18} />
            ) : (
              <DownloadIcon width={18} height={18} />
            )}
            {bothDownloaded ? 'Both saved' : 'Download both tracks'}
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-8 py-4 border border-white/15 rounded-xl font-semibold hover:border-white/40 hover:bg-white/5 transition-all"
          >
            <PlusIcon width={18} height={18} />
            Upload another
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl p-px bg-gradient-to-br from-white/10 to-white/[0.02]">
          <div className="grid sm:grid-cols-3 rounded-2xl bg-[#101010] divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
            <Link
              href="/profile"
              className="group flex items-center gap-3.5 p-5 hover:bg-white/[0.03] transition-colors"
            >
              <div className="w-10 h-10 shrink-0 rounded-lg bg-[#4d7cff]/10 flex items-center justify-center text-[#4d7cff] transition-transform group-hover:scale-110">
                <FolderIcon width={20} height={20} />
              </div>
              <div className="min-w-0">
                <div className="font-medium">View all tracks</div>
                <div className="text-sm text-white/50">Access your library</div>
              </div>
            </Link>
            <Link
              href="/credits"
              className="group flex items-center gap-3.5 p-5 hover:bg-white/[0.03] transition-colors"
            >
              <div className="w-10 h-10 shrink-0 rounded-lg bg-[#4d7cff]/10 flex items-center justify-center text-[#4d7cff] transition-transform group-hover:scale-110">
                <ZapIcon width={20} height={20} />
              </div>
              <div className="min-w-0">
                <div className="font-medium">Buy more credits</div>
                <div className="text-sm text-white/50">Keep separating</div>
              </div>
            </Link>
            <Link
              href="/"
              className="group flex items-center gap-3.5 p-5 hover:bg-white/[0.03] transition-colors"
            >
              <div className="w-10 h-10 shrink-0 rounded-lg bg-[#4d7cff]/10 flex items-center justify-center text-[#4d7cff] transition-transform group-hover:scale-110">
                <UploadIcon width={20} height={20} />
              </div>
              <div className="min-w-0">
                <div className="font-medium">New separation</div>
                <div className="text-sm text-white/50">Upload another</div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
