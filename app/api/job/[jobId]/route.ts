import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

    // Already finished — return stored values
    if (job.status === 'done' || job.status === 'failed') {
      return NextResponse.json({
        status: job.status,
        vocal_url: job.vocal_url,
        instrumental_url: job.instrumental_url,
      })
    }

    const taskId = job.lalal_vocal_task_id
    if (!taskId) {
      return NextResponse.json({
        status: job.status,
        vocal_url: job.vocal_url,
        instrumental_url: job.instrumental_url,
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
        vocal_url: job.vocal_url,
        instrumental_url: job.instrumental_url,
      })
    }

    const checkResult = await checkResponse.json()
    const task = checkResult.result?.[taskId]

    let internalStatus = job.status
    let vocalUrl = job.vocal_url
    let instrumentalUrl = job.instrumental_url
    let progress = 0

    const taskStatus = task?.status

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
      const tracks = task?.result?.tracks || []

      // The vocals separation returns both the isolated vocal ("stem") and the
      // remaining instrumental ("back"). Match defensively by type or label.
      for (const t of tracks) {
        const kind = String(t.type || t.label || '').toLowerCase()
        if (!vocalUrl && (kind.includes('stem') || kind.includes('vocal'))) {
          vocalUrl = t.url
        }
        if (
          !instrumentalUrl &&
          (kind.includes('back') ||
            kind.includes('instrument') ||
            kind.includes('no_vocal') ||
            kind.includes('music'))
        ) {
          instrumentalUrl = t.url
        }
      }

      // Fallbacks for alternative response shapes
      if (!vocalUrl && task?.result?.stem_track) {
        vocalUrl = task.result.stem_track
      }
      if (!instrumentalUrl && task?.result?.back_track) {
        instrumentalUrl = task.result.back_track
      }

      // If still unmatched but exactly two tracks, assign by order
      if ((!vocalUrl || !instrumentalUrl) && tracks.length === 2) {
        vocalUrl = vocalUrl || tracks[0].url
        instrumentalUrl = instrumentalUrl || tracks[1].url
      }

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
      vocal_url: vocalUrl,
      instrumental_url: instrumentalUrl,
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
