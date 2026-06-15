'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Database } from '@/lib/database.types'
import { UploadIcon, SeparateIcon, CloseIcon, ArrowRightIcon, PlayIcon, PauseIcon } from '@/components/icons'
import { ContactModal } from '@/components/ContactModal'
import { creditsForDuration, MINUTES_PER_CREDIT } from '@/lib/credits'

type Job = Database['public']['Tables']['jobs']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [fileDuration, setFileDuration] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'starting' | 'error'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [playingTrack, setPlayingTrack] = useState<string | null>(null)
  const [playingVersion, setPlayingVersion] = useState<'original' | 'vocals' | 'instrumental'>('original')
  const [progress, setProgress] = useState<{ time: number; duration: number }>({ time: 0, duration: 0 })
  const audioRefs = useRef<{ [key: string]: { original: HTMLAudioElement | null; vocals: HTMLAudioElement | null; instrumental: HTMLAudioElement | null } }>({})

  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sample tracks for before/after demo
  const sampleTracks = [
    {
      id: 'sample-1',
      name: 'RokedLi',
      artist: 'Itzik Dadya',
      albumArt: '/samples/album1.jpg',
      original: '/samples/track1-original.mp3',
      vocals: '/samples/track1-vocals.mp3',
      instrumental: '/samples/track1-instrumental.mp3',
    },
    {
      id: 'sample-2',
      name: 'L\'chai Olamim',
      artist: 'Matt Dubb, Mordechai Shapiro, Benny Friedman',
      albumArt: '/samples/album2.jpg',
      original: '/samples/track2-original.mp3',
      vocals: '/samples/track2-vocals.mp3',
      instrumental: '/samples/track2-instrumental.mp3',
    },
    {
      id: 'sample-3',
      name: 'Kel Mistater',
      artist: 'Sruly Green',
      albumArt: '/samples/album3.jpg',
      original: '/samples/track3-original.mp3',
      vocals: '/samples/track3-vocals.mp3',
      instrumental: '/samples/track3-instrumental.mp3',
    },
    {
      id: 'sample-4',
      name: 'Yerei Shamayim',
      artist: 'Shmueli Ungar',
      albumArt: '/samples/album4.jpg',
      original: '/samples/track4-original.mp3',
      vocals: '/samples/track4-vocals.mp3',
      instrumental: '/samples/track4-instrumental.mp3',
    },
  ]

  const handlePlaySample = (trackId: string, version: 'original' | 'vocals' | 'instrumental') => {
    const track = sampleTracks.find((t) => t.id === trackId)
    if (!track) return

    const instances = audioRefs.current[trackId]
    if (!instances) return

    const newAudio = instances[version]
    if (!newAudio) return

    // If clicking the same track/version, toggle pause
    if (playingTrack === trackId && playingVersion === version) {
      if (!newAudio.paused) {
        newAudio.pause()
        setPlayingTrack(null)
      } else {
        newAudio.play()
        setPlayingTrack(trackId)
      }
      return
    }

    const isSameTrack = playingTrack === trackId
    let currentTime = 0

    // If switching versions of the same track, get current time and pause old version
    if (isSameTrack) {
      const oldAudio = instances[playingVersion]
      if (oldAudio) {
        currentTime = oldAudio.currentTime
        oldAudio.pause()
      }
    } else {
      // If switching tracks, pause all versions of the old track
      if (playingTrack && audioRefs.current[playingTrack]) {
        Object.values(audioRefs.current[playingTrack]).forEach(audio => {
          if (audio) audio.pause()
        })
      }
    }

    // Play new version at the same position
    setPlayingTrack(trackId)
    setPlayingVersion(version)
    
    if (isSameTrack && currentTime > 0) {
      newAudio.currentTime = currentTime
    }
    
    newAudio.play()
  }

  const handleSeek = (trackId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const instances = audioRefs.current[trackId]
    if (!instances || !playingTrack) return

    const audio = instances[playingVersion]
    if (!audio || !audio.duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    audio.currentTime = percentage * audio.duration
  }

  // Initialize audio elements (3 per track for seamless switching)
  useEffect(() => {
    sampleTracks.forEach((track) => {
      if (!audioRefs.current[track.id]) {
        // Create three audio elements, one for each version
        const originalAudio = new Audio(track.original)
        const vocalsAudio = new Audio(track.vocals)
        const instrumentalAudio = new Audio(track.instrumental)

        // Preload all versions
        originalAudio.preload = 'auto'
        vocalsAudio.preload = 'auto'
        instrumentalAudio.preload = 'auto'

        // Set up event listeners for all three
        const handleTimeUpdate = (audio: HTMLAudioElement) => () => {
          setProgress({ time: audio.currentTime, duration: audio.duration })
        }

        const handleEnded = () => {
          setPlayingTrack(null)
        }

        originalAudio.addEventListener('timeupdate', handleTimeUpdate(originalAudio))
        vocalsAudio.addEventListener('timeupdate', handleTimeUpdate(vocalsAudio))
        instrumentalAudio.addEventListener('timeupdate', handleTimeUpdate(instrumentalAudio))

        originalAudio.addEventListener('ended', handleEnded)
        vocalsAudio.addEventListener('ended', handleEnded)
        instrumentalAudio.addEventListener('ended', handleEnded)

        audioRefs.current[track.id] = {
          original: originalAudio,
          vocals: vocalsAudio,
          instrumental: instrumentalAudio,
        }
      }
    })

    // Cleanup
    return () => {
      Object.values(audioRefs.current).forEach((instances) => {
        if (instances) {
          Object.values(instances).forEach((audio) => {
            if (audio) {
              audio.pause()
              audio.src = ''
            }
          })
        }
      })
      audioRefs.current = {}
    }
  }, [])


  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUser(user)

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(profileData)

        const { data: jobsData } = await supabase
          .from('jobs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        setJobs(jobsData || [])
      }

      setLoading(false)
    }

    loadData()
  }, [])

  const handleFileSelect = (selectedFile: File) => {
    if (loading) return

    if (selectedFile.size > 20 * 1024 * 1024) {
      alert('File must be under 20MB')
      return
    }

    const validTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/flac',
      'audio/x-flac',
    ]
    if (
      !validTypes.includes(selectedFile.type) &&
      !selectedFile.name.match(/\.(mp3|wav|flac)$/i)
    ) {
      alert('Please upload MP3, WAV, or FLAC files only')
      return
    }

    setFile(selectedFile)
    setFileDuration(null)
    setUploadState('idle')
    setUploadProgress(0)

    // Read the track length so we can show how many credits it'll use
    // (1 credit per 6 minutes). This runs entirely in the browser.
    const objectUrl = URL.createObjectURL(selectedFile)
    const probe = new Audio()
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) setFileDuration(probe.duration)
      URL.revokeObjectURL(objectUrl)
    }
    probe.onerror = () => {
      URL.revokeObjectURL(objectUrl)
    }
    probe.src = objectUrl
  }

  const creditsNeeded = fileDuration ? creditsForDuration(fileDuration) : 1

  const handleUploadClick = () => {
    if (!file) return

    if (!user) {
      setShowAuthPrompt(true)
      return
    }

    if (profile && profile.credits < creditsNeeded) {
      router.push('/credits')
      return
    }

    uploadFile(file)
  }

  const uploadFile = async (fileToUpload: File) => {
    setUploadState('uploading')
    setUploadProgress(0)

    const fail = () => {
      setUploadState('error')
      setTimeout(() => setUploadState('idle'), 3000)
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      fail()
      return
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) {
      fail()
      return
    }

    const jobId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const ext = (fileToUpload.name.split('.').pop() || 'mp3').toLowerCase()
    const storagePath = `${session.user.id}/${jobId}/original.${ext}`

    // 1. Upload the file straight to Supabase Storage. We go directly to the
    //    Storage REST endpoint (instead of through our own API) so the upload
    //    isn't capped by Netlify's ~4.5MB serverless request limit, and we can
    //    still report real upload progress to the user.
    const uploaded = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open(
        'POST',
        `${supabaseUrl}/storage/v1/object/tracks/${storagePath}`
      )
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
      xhr.setRequestHeader('apikey', anonKey)
      xhr.setRequestHeader('x-upsert', 'false')
      xhr.setRequestHeader(
        'Content-Type',
        fileToUpload.type || 'application/octet-stream'
      )

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(pct)
          if (pct >= 100) setUploadState('starting')
        }
      }

      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
      xhr.onerror = () => resolve(false)
      xhr.send(fileToUpload)
    })

    if (!uploaded) {
      fail()
      return
    }

    setUploadState('starting')

    // 2. Ask the server to start LALAL.AI processing. This is a small JSON
    //    request, so it stays well within serverless limits.
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jobId,
          storagePath,
          filename: fileToUpload.name,
          duration: fileDuration,
        }),
      })

      if (!res.ok) {
        if (res.status === 402) {
          router.push('/credits')
          return
        }
        console.error('Upload failed:', await res.text())
        fail()
        return
      }

      const data = await res.json()
      router.push(`/processing/${data.jobId}`)
    } catch (err) {
      console.error('Upload failed:', err)
      fail()
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFileSelect(droppedFile)
  }

  const isBusy = uploadState === 'uploading' || uploadState === 'starting'

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0e0e0e] text-white text-sm">
      {/* Ambient glow */}
      <div className="glow-blob" style={{ width: 460, height: 460, top: -160, left: '50%', marginLeft: -230 }} />

      {/* Top Nav */}
      <nav className="relative z-20 px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <img src="/logo-gradient.svg" alt="Havdolo" className="h-8 sm:h-9 w-auto" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {loading ? null : user ? (
              <>
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
                <Link
                  href="/credits"
                  className="px-5 sm:px-6 h-[42px] flex items-center rounded-lg bg-[#4d7cff] text-white text-sm font-semibold hover:bg-[#3f6cf5] transition-all hover:scale-[1.02] whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Get credits</span>
                  <span className="sm:hidden">Credits</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/auth"
                  className="text-sm text-white/60 hover:text-white transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/credits"
                  className="px-5 sm:px-6 h-[42px] flex items-center rounded-lg bg-[#4d7cff] text-white text-sm font-semibold hover:bg-[#3f6cf5] transition-all hover:scale-[1.02] whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Get credits</span>
                  <span className="sm:hidden">Credits</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero — matches the nav content width */}
      <header className="relative z-10 max-w-5xl mx-auto px-5 sm:px-6 pt-10 sm:pt-24 pb-20 sm:pb-40 text-center">
        <p className="animate-fade-in-up inline-flex items-center gap-2 text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#6b93ff]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4d7cff] animate-pulse-soft" />
          The first of its kind
        </p>

        <h1 className="mt-5 sm:mt-6 text-[2.4rem] sm:text-6xl md:text-7xl font-bold leading-[1.08] sm:leading-[1.03] tracking-tight text-balance">
          <span className="block animate-fade-in-up delay-100">AI-powered vocal remover</span>
          <span className="block animate-fade-in-up delay-200">
            made for <span className="shimmer-text">Jewish music</span>.
          </span>
        </h1>

        <p className="mt-4 sm:mt-7 animate-fade-in-up delay-300 text-sm text-white/55 max-w-xl mx-auto leading-relaxed">
          Trained on hundreds of Jewish songs, our AI understands the unique textures of Jewish music.
        </p>
      </header>

      {/* Upload card — overlaps the hero */}
      <main className="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 -mt-12 sm:-mt-24">
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`animate-soft-pulse group relative rounded-2xl sm:rounded-lg bg-[#141414] px-6 py-10 sm:p-12 text-center cursor-pointer transition-all duration-300 ${
              isDragging ? 'bg-[#1b1b1b] scale-[1.01]' : 'active:bg-[#1b1b1b] hover:bg-[#171717]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0]
                if (selectedFile) handleFileSelect(selectedFile)
              }}
              className="hidden"
            />

            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-[#4d7cff]/15 text-[#6b93ff] flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <UploadIcon width={26} height={26} />
              </div>
            </div>

            <p className="text-lg sm:text-xl font-medium mb-2">
              {isDragging ? 'Drop it here' : 'Tap to upload your track'}
            </p>
            <p className="text-sm text-white/40">
              <span className="hidden sm:inline">or </span>
              <span className="text-[#6b93ff] underline underline-offset-4">browse files</span>
            </p>
            <p className="mt-2 text-xs text-white/30">
              MP3, WAV, FLAC · up to 20MB · 1 credit per {MINUTES_PER_CREDIT} min
            </p>
          </div>
        ) : (
          <div className="rounded-2xl sm:rounded-lg bg-[#141414] p-6 sm:p-8 animate-soft-pulse">
            <div className="mb-6 text-left">
              <p className="text-white text-lg sm:text-xl font-medium truncate">{file.name}</p>
              <p className="text-white/40 text-sm tabular-nums">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
                {fileDuration ? ` · ${formatTime(fileDuration)}` : ''}
              </p>
            </div>

            {/* Credit cost — 1 credit per 6 minutes of audio */}
            <div
              className={`mb-6 rounded-lg px-4 py-3 text-sm ${
                creditsNeeded > 1
                  ? 'bg-[#ff8c42]/10 border border-[#ff8c42]/25 text-[#ffb482]'
                  : 'bg-white/5 border border-white/10 text-white/70'
              }`}
            >
              {fileDuration ? (
                <div className="flex items-center justify-between gap-3">
                  <span>
                    {creditsNeeded > 1 ? (
                      <>
                        This track is over {MINUTES_PER_CREDIT} min, so it&apos;ll use{' '}
                        <span className="font-semibold">{creditsNeeded} credits</span>.
                      </>
                    ) : (
                      <>
                        This track uses <span className="font-semibold">1 credit</span>.
                      </>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {creditsNeeded} {creditsNeeded === 1 ? 'credit' : 'credits'}
                  </span>
                </div>
              ) : (
                <span className="text-white/50">
                  Each credit covers up to {MINUTES_PER_CREDIT} minutes of audio.
                </span>
              )}
              {user && profile && fileDuration && profile.credits < creditsNeeded && (
                <p className="mt-2 text-[#ff8c42]">
                  You have {profile.credits} {profile.credits === 1 ? 'credit' : 'credits'} —
                  you&apos;ll need {creditsNeeded - profile.credits} more.
                </p>
              )}
            </div>

            {isBusy && (
              <div className="mb-6 animate-fade-in">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-white/70">
                    {uploadState === 'starting' ? 'Starting separation…' : 'Uploading…'}
                  </span>
                  <span className="text-white/70 tabular-nums">
                    {uploadState === 'starting' ? '' : `${uploadProgress}%`}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  {uploadState === 'starting' ? (
                    <div className="h-full w-full bg-[#4d7cff] animate-pulse-soft" />
                  ) : (
                    <div
                      className="h-full bg-[#4d7cff] transition-all duration-200 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={handleUploadClick}
                disabled={isBusy}
                className={`flex flex-1 items-center justify-center gap-2 px-8 py-3.5 sm:py-3 bg-[#4d7cff] text-white rounded-lg font-medium transition-all ${
                  isBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#3f6cf5] active:scale-[0.99] sm:hover:scale-[1.02]'
                }`}
              >
                {!isBusy && uploadState !== 'error' && <SeparateIcon width={18} height={18} />}
                {uploadState === 'uploading'
                  ? 'Uploading…'
                  : uploadState === 'starting'
                    ? 'Starting…'
                    : uploadState === 'error'
                      ? 'Failed, try again'
                      : 'Separate vocals & music'}
              </button>
              <button
                onClick={() => {
                  setFile(null)
                  setFileDuration(null)
                  setUploadProgress(0)
                  setUploadState('idle')
                }}
                disabled={isBusy}
                className={`flex items-center justify-center gap-2 px-6 py-3 border border-white/15 rounded-lg font-medium transition-colors ${
                  isBusy ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/40 active:border-white/40'
                }`}
              >
                <CloseIcon width={16} height={16} />
                Remove
              </button>
            </div>
          </div>
        )}

        {/* How it works */}
        <section className="mt-12 sm:mt-20">
          <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
            {[
              { n: '01', t: 'Upload', d: 'Drop in any audio file — MP3, WAV, or FLAC.' },
              { n: '02', t: 'Separate', d: 'Our AI isolates the vocals from the music.' },
              { n: '03', t: 'Download', d: 'Grab the vocals, the music, or both.' },
            ].map((step) => (
              <div key={step.n} className="text-center">
                <div className="text-sm font-mono text-[#6b93ff] mb-3 tracking-wider">{step.n}</div>
                <h3 className="text-xl font-semibold mb-2">{step.t}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{step.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section divider */}
        <div className="section-divider mt-16 sm:mt-24" aria-hidden="true">
          <span className="section-divider__dot" />
        </div>

        {/* Before & After Demo */}
        <section className="relative mt-8 sm:mt-12">
          {/* Ambient glow instead of a solid container */}
          <div className="glow-blob" style={{ width: 380, height: 380, top: 40, left: '50%', marginLeft: -190 }} />

          <div className="relative">
            <div className="text-center mb-8 sm:mb-10">
              <p className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-[#6b93ff] mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4d7cff] animate-pulse-soft" />
                Real results
              </p>
              <h2 className="text-xl font-bold mb-2">Hear the difference</h2>
              <p className="text-sm text-white/55 max-w-2xl mx-auto leading-relaxed">
                A sample of tracks that use this software.
              </p>
            </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            {sampleTracks.map((track, index) => {
              const isPlaying = playingTrack === track.id
              const activeVersion = isPlaying ? playingVersion : null

              return (
                <div
                  key={track.id}
                  className={`
                    group relative rounded-2xl p-px transition-all
                    ${
                      isPlaying
                        ? 'bg-gradient-to-br from-[#4d7cff] to-[#4d7cff]/20 shadow-xl shadow-[#4d7cff]/20'
                        : 'bg-gradient-to-br from-white/15 to-white/[0.03] hover:from-white/25'
                    }
                  `}
                >
                  <div className="relative rounded-2xl bg-[#101010] p-5 sm:p-6 overflow-hidden">
                    {/* Header: album art + track info */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-white/5 shadow-lg">
                        <img
                          src={track.albumArt}
                          alt={`${track.name} album art`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-xl leading-tight">{track.name}</h3>
                        <p className="text-sm text-white/40 mt-0.5">{track.artist}</p>
                      </div>
                    </div>

                    {/* Clickable progress bar */}
                    <div className="mb-4">
                      <div 
                        className="h-2 rounded-full bg-white/10 overflow-hidden cursor-pointer hover:bg-white/15 transition-colors"
                        onClick={(e) => handleSeek(track.id, e)}
                      >
                        <div
                          className="h-full bg-[#4d7cff] rounded-full transition-[width] duration-150 ease-linear"
                          style={{
                            width: `${
                              isPlaying && progress.duration > 0
                                ? Math.min(100, (progress.time / progress.duration) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs font-mono text-white/45 tabular-nums">
                        <span>{isPlaying ? formatTime(progress.time) : '0:00'}</span>
                        <span>{isPlaying && progress.duration > 0 ? formatTime(progress.duration) : '0:00'}</span>
                      </div>
                    </div>

                    {/* Version toggle buttons */}
                    <div className="flex gap-2">
                      {([
                        { key: 'original', label: 'Original' },
                        { key: 'vocals', label: 'Vocals' },
                        { key: 'instrumental', label: 'Music' },
                      ] as const).map(({ key, label }) => {
                        const active = isPlaying && activeVersion === key
                        return (
                          <button
                            key={key}
                            onClick={() => handlePlaySample(track.id, key)}
                            className={`
                              flex-1 min-w-0 px-2.5 sm:px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5
                              ${
                                active
                                  ? 'bg-[#4d7cff] text-white hover:bg-[#3f6cf5]'
                                  : 'bg-white/5 text-white/70 hover:bg-white/10 active:bg-white/10 hover:text-white'
                              }
                            `}
                          >
                            {active ? (
                              <PauseIcon width={12} height={12} className="shrink-0" />
                            ) : (
                              <PlayIcon width={12} height={12} className="shrink-0" />
                            )}
                            <span className="truncate">{label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          </div>
        </section>


        <footer className="mt-20 pb-16 safe-pb text-center">
          <button
            onClick={() => setShowContactModal(true)}
            className="text-white/60 hover:text-[#4d7cff] transition-colors text-sm font-medium"
          >
            Contact us
          </button>
        </footer>
      </main>

      {/* Auth Prompt Modal */}
      {showAuthPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-6 animate-fade-in">
          <div className="bg-[#161616] border border-white/10 rounded-lg p-8 max-w-md w-full animate-fade-in-up">
            <h2 className="text-xl font-bold mb-3">Create a free account to continue</h2>
            <p className="text-white/60 mb-6">
              Your file is ready and waiting — sign up or sign in and we&apos;ll pick up right
              where you left off.
            </p>

            <div className="flex gap-3">
              <Link
                href="/auth"
                className="flex-1 px-6 py-3 bg-[#4d7cff] text-white rounded-lg font-medium text-center hover:bg-[#3f6cf5] transition-colors"
              >
                Sign up
              </Link>
              <Link
                href="/auth"
                className="flex-1 px-6 py-3 border border-white/20 rounded-lg font-medium text-center hover:border-white/50 transition-colors"
              >
                Sign in
              </Link>
            </div>

            <button
              onClick={() => setShowAuthPrompt(false)}
              className="w-full mt-4 text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
    </div>
  )
}
