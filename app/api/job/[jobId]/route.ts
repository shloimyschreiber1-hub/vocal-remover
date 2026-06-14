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

      // The vocals separation returns both the isolated vocal ("stem") and the
      // remaining instrumental ("back"). Match by label first, then type.
      for (const t of tracks) {
        const label = String(t.label || '').toLowerCase()
        const type = String(t.type || '').toLowerCase()
        console.log(`Processing track: label="${label}", type="${type}", url="${t.url}"`)
        
        // Match vocal/stem track - prioritize exact matches
        if (!vocalUrl) {
          if (label === 'stem' || label === 'vocals' || label === 'vocal' ||
              type === 'stem' || type === 'vocals' || type === 'vocal' ||
              label.includes('vocal') || type.includes('vocal')) {
            vocalUrl = t.url
            console.log('✓ Assigned vocal URL:', vocalUrl)
            continue
          }
        }
        
        // Match instrumental/back track - prioritize exact matches
        if (!instrumentalUrl) {
          if (label === 'back' || label === 'instrumental' || label === 'no_vocals' || label === 'music' ||
              type === 'back' || type === 'instrumental' || type === 'no_vocals' || type === 'music' ||
              label.includes('back') || label.includes('instrument') || label.includes('music') ||
              type.includes('back') || type.includes('instrument') || type.includes('music')) {
            instrumentalUrl = t.url
            console.log('✓ Assigned instrumental URL:', instrumentalUrl)
            continue
          }
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

      // If still unmatched but exactly two tracks, we need to distinguish them
      // by checking which URL is which (they should be different)
      if ((!vocalUrl || !instrumentalUrl) && tracks.length === 2) {
        // Ensure the tracks are actually different
        if (tracks[0].url !== tracks[1].url) {
          // Try to infer from filename or just assign by convention
          // (LALAL.AI typically returns stem first, back second)
          if (!vocalUrl) {
            vocalUrl = tracks[0].url
            console.log('Assigned vocals by position [0]:', vocalUrl)
          }
          if (!instrumentalUrl) {
            instrumentalUrl = tracks[1].url
            console.log('Assigned instrumental by position [1]:', instrumentalUrl)
          }
        } else {
          console.error('⚠️  WARNING: Both tracks have the same URL! This is unexpected.')
          console.error('Track URLs:', tracks.map((t: Track) => t.url))
          // Assign the same URL to both to avoid null, but log the error
          vocalUrl = vocalUrl || tracks[0].url
          instrumentalUrl = instrumentalUrl || tracks[0].url
        }
      }

      // Final validation
      if (vocalUrl === instrumentalUrl && vocalUrl) {
        console.error('⚠️  CRITICAL: Vocal and instrumental URLs are identical!')
        console.error('This means LALAL.AI returned the same file for both tracks.')
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
