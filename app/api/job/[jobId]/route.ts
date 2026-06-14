import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Track = {
  url: string | null
  label?: string
  type?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { jobId } = await params

    const authClient = await createClient()
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: job, error: jobError } = await admin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Helper to proxy audio URLs through our server to bypass CORS restrictions
    const proxyUrl = (url: string | null) => {
      if (!url) return null
      // Get the base URL from the request
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const host = request.headers.get('host') || 'localhost:3000'
      const baseUrl = `${protocol}://${host}`
      return `${baseUrl}/api/proxy-audio?url=${encodeURIComponent(url)}`
    }

    // Already finished — return stored values
    if (job.status === 'done' || job.status === 'failed') {
      return NextResponse.json({
        status: job.status,
        vocal_url: proxyUrl(job.vocal_url),
        instrumental_url: proxyUrl(job.instrumental_url),
      })
    }

    const taskId = job.lalal_vocal_task_id
    if (!taskId) {
      return NextResponse.json({
        status: job.status,
        vocal_url: proxyUrl(job.vocal_url),
        instrumental_url: proxyUrl(job.instrumental_url),
      })
    }

    const checkResponse = await fetch('https://www.lalal.ai/api/v1/check/', {
      method: 'POST',
      headers: {
        'X-License-Key': process.env.LALAL_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task_ids: [taskId] }),
    })

    if (!checkResponse.ok) {
      console.error('LALAL.AI check failed:', await checkResponse.text())
      return NextResponse.json({
        status: job.status,
        vocal_url: proxyUrl(job.vocal_url),
        instrumental_url: proxyUrl(job.instrumental_url),
      })
    }

    const checkResult = await checkResponse.json()
    const task = checkResult.result?.[taskId]

    let internalStatus = job.status
    let vocalUrl = job.vocal_url
    let instrumentalUrl = job.instrumental_url
    let progress = 0

    const taskStatus = task?.status
    
    // If task is successful, start fresh to parse the new response
    // (don't use potentially stale URLs from database)
    if (taskStatus === 'success') {
      vocalUrl = null
      instrumentalUrl = null
      console.log('Task successful - parsing fresh track URLs from LALAL.AI response')
    }

    if (taskStatus === 'error' || taskStatus === 'server_error') {
      console.error('LALAL.AI task error:', task?.error || task)
      internalStatus = 'failed'

      // Refund the credit
      const { data: profile } = await admin
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()

      if (profile) {
        await admin
          .from('profiles')
          .update({ credits: profile.credits + 1 })
          .eq('id', user.id)
      }
    } else if (taskStatus === 'progress') {
      progress = task?.progress || 0
      internalStatus = progress < 50 ? 'analysing' : 'separating'
    } else if (taskStatus === 'success') {
      progress = 100
      const tracks: Track[] = task?.result?.tracks || []

      // Log the full response for debugging
      console.log('LALAL.AI task result:', JSON.stringify(task?.result, null, 2))
      console.log('Tracks array:', JSON.stringify(tracks, null, 2))

      // Helper function to analyze URL and determine track type from filename
      const analyzeUrl = (url: string | null): { isStem: boolean; isBack: boolean } => {
        if (!url) return { isStem: false, isBack: false }
        const urlLower = url.toLowerCase()
        return {
          isStem: urlLower.includes('_stem') || urlLower.includes('_vocals') || urlLower.includes('_vocal'),
          isBack: urlLower.includes('_no_vocals') || urlLower.includes('_instrumental') || urlLower.includes('_back')
        }
      }

      // Try to match tracks more intelligently
      for (const t of tracks) {
        const label = String(t.label || '').toLowerCase()
        const type = String(t.type || '').toLowerCase()
        const urlAnalysis = analyzeUrl(t.url)
        
        console.log(`Processing track: label="${label}", type="${type}", url="${t.url}"`)
        console.log(`  URL analysis: isStem=${urlAnalysis.isStem}, isBack=${urlAnalysis.isBack}`)
        
        // Determine if this is a vocal/stem track
        const isVocalTrack = 
          label === 'stem' || label === 'vocals' || label === 'vocal' ||
          type === 'stem' || type === 'vocals' || type === 'vocal' ||
          urlAnalysis.isStem ||
          (label.includes('vocal') && !label.includes('no_vocal'))
        
        // Determine if this is an instrumental/back track
        const isInstrumentalTrack = 
          label === 'back' || label === 'instrumental' || label === 'no_vocals' || label === 'music' ||
          type === 'back' || type === 'instrumental' || type === 'no_vocals' || type === 'music' ||
          urlAnalysis.isBack ||
          label.includes('no_vocal') || label.includes('instrument')
        
        // Assign with priority: exact matches first
        if (isVocalTrack && !vocalUrl) {
          vocalUrl = t.url
          console.log('✓ Assigned vocal URL:', vocalUrl)
        } else if (isInstrumentalTrack && !instrumentalUrl) {
          instrumentalUrl = t.url
          console.log('✓ Assigned instrumental URL:', instrumentalUrl)
        }
      }

      // Fallbacks for alternative response shapes
      if (!vocalUrl && task?.result?.stem_track) {
        vocalUrl = task.result.stem_track
        console.log('Using stem_track fallback for vocals:', vocalUrl)
      }
      if (!instrumentalUrl && task?.result?.back_track) {
        instrumentalUrl = task.result.back_track
        console.log('Using back_track fallback for instrumental:', instrumentalUrl)
      }

      // If we still don't have both tracks but have exactly 2 tracks, use URL analysis
      if ((!vocalUrl || !instrumentalUrl) && tracks.length === 2) {
        console.log('Attempting URL-based assignment for 2 tracks...')
        const track0Analysis = analyzeUrl(tracks[0].url)
        const track1Analysis = analyzeUrl(tracks[1].url)
        
        if (track0Analysis.isStem && track1Analysis.isBack) {
          vocalUrl = vocalUrl || tracks[0].url
          instrumentalUrl = instrumentalUrl || tracks[1].url
          console.log('Assigned by URL pattern: track[0]=vocals, track[1]=instrumental')
        } else if (track1Analysis.isStem && track0Analysis.isBack) {
          vocalUrl = vocalUrl || tracks[1].url
          instrumentalUrl = instrumentalUrl || tracks[0].url
          console.log('Assigned by URL pattern: track[1]=vocals, track[0]=instrumental')
        } else if (tracks[0].url !== tracks[1].url) {
          // Last resort: assign by position (LALAL.AI typically returns stem first)
          vocalUrl = vocalUrl || tracks[0].url
          instrumentalUrl = instrumentalUrl || tracks[1].url
          console.log('Assigned by position fallback: track[0]=vocals, track[1]=instrumental')
        }
      }

      // Validation: Ensure we didn't assign the same URL to both
      if (vocalUrl && instrumentalUrl && vocalUrl === instrumentalUrl) {
        console.error('⚠️  CRITICAL ERROR: Same URL assigned to both tracks!')
        console.error('Vocal URL:', vocalUrl)
        console.error('Instrumental URL:', instrumentalUrl)
        console.error('This indicates a logic error or unexpected API response.')
        
        // Try to fix by reassigning from tracks array
        if (tracks.length >= 2 && tracks[0].url !== tracks[1].url) {
          console.log('Attempting emergency reassignment...')
          vocalUrl = tracks[0].url
          instrumentalUrl = tracks[1].url
          console.log('Emergency reassignment complete')
        }
      }

      console.log('Final URLs - Vocals:', vocalUrl, 'Instrumental:', instrumentalUrl)
      internalStatus = vocalUrl && instrumentalUrl ? 'done' : 'exporting'
    }

    const { error: updateError } = await admin
      .from('jobs')
      .update({
        status: internalStatus,
        vocal_url: vocalUrl,
        instrumental_url: instrumentalUrl,
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('Job update error:', updateError)
    }

    return NextResponse.json({
      status: internalStatus,
      vocal_url: proxyUrl(vocalUrl),
      instrumental_url: proxyUrl(instrumentalUrl),
      progress,
    })
  } catch (error) {
    console.error('Job status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
