import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Debug endpoint to inspect job data and LALAL.AI response
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    const admin = createAdminClient()

    const { data: job, error: jobError } = await admin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // If job has a task ID, fetch the current status from LALAL.AI
    let lalalResponse = null
    if (job.lalal_vocal_task_id) {
      const checkResponse = await fetch('https://www.lalal.ai/api/v1/check/', {
        method: 'POST',
        headers: {
          'X-License-Key': process.env.LALAL_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task_ids: [job.lalal_vocal_task_id] }),
      })

      if (checkResponse.ok) {
        lalalResponse = await checkResponse.json()
      }
    }

    return NextResponse.json({
      debug: {
        jobId: job.id,
        userId: job.user_id,
        status: job.status,
        originalFilename: job.original_filename,
        lalalJobId: job.lalal_job_id,
        lalalVocalTaskId: job.lalal_vocal_task_id,
        lalalInstrumentalTaskId: job.lalal_instrumental_task_id,
        storedVocalUrl: job.vocal_url,
        storedInstrumentalUrl: job.instrumental_url,
        createdAt: job.created_at,
      },
      lalalResponse: lalalResponse,
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
