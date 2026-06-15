import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { creditsForDuration } from '@/lib/credits'

// Allow up to a minute: this route pulls the original out of Supabase Storage
// and forwards it to LALAL.AI, which can take a while for larger files.
export const maxDuration = 60

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20MB

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'No authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Validate the user's token (anon client just for token verification)
    const authClient = await createClient()
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', detail: authError?.message || 'Invalid token' },
        { status: 401 }
      )
    }

    // The browser uploads the audio directly to Supabase Storage (this avoids
    // Netlify's ~4.5MB serverless request limit), then sends us only the path.
    const body = await request.json().catch(() => null)
    const jobId = body?.jobId as string | undefined
    const storagePath = body?.storagePath as string | undefined
    const filename = body?.filename as string | undefined

    if (!jobId || !storagePath || !filename) {
      return NextResponse.json(
        { error: 'Missing jobId, storagePath, or filename' },
        { status: 400 }
      )
    }

    // Security: a user may only reference an object inside their own folder.
    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 })
    }

    // Service-role client for all storage + DB writes (bypasses RLS safely)
    const admin = createAdminClient()

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError)
      return NextResponse.json(
        { error: 'Profile not found', detail: profileError?.message },
        { status: 404 }
      )
    }

    if (profile.credits < 1) {
      return NextResponse.json({ error: 'No credits' }, { status: 403 })
    }

    // Pull the original back out of storage (uploaded directly by the browser).
    const { data: fileData, error: downloadError } = await admin.storage
      .from('tracks')
      .download(storagePath)

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError)
      return NextResponse.json(
        { error: 'Could not read uploaded file', detail: downloadError?.message },
        { status: 400 }
      )
    }

    // Enforce the 20MB cap server-side as well (clients can be bypassed).
    if (fileData.size > MAX_FILE_BYTES) {
      await admin.storage.from('tracks').remove([storagePath])
      return NextResponse.json(
        { error: 'File exceeds the 20MB limit' },
        { status: 413 }
      )
    }

    const fileBuffer = await fileData.arrayBuffer()

    const { error: jobError } = await admin.from('jobs').insert({
      id: jobId,
      user_id: user.id,
      lalal_job_id: '',
      status: 'pending',
      original_filename: filename,
    })

    if (jobError) {
      console.error('Job creation error:', jobError)
      return NextResponse.json(
        { error: 'Job creation failed', detail: jobError.message },
        { status: 500 }
      )
    }

    // HTTP header values must be Latin-1 only. Filenames with non-ASCII
    // characters (e.g. Hebrew) would throw "Cannot convert argument to a
    // ByteString", so build a safe ASCII name for the header while keeping the
    // original name (already stored above) and the real extension intact.
    const ext = filename.includes('.') ? filename.split('.').pop() : ''
    const asciiBase =
      filename
        .replace(/\.[^.]*$/, '')
        .replace(/[^\x20-\x7E]/g, '_')
        .replace(/["\\]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .trim() || 'track'
    const headerFilename = ext ? `${asciiBase}.${ext}` : asciiBase

    // 1. Upload the audio to LALAL.AI (raw binary)
    const lalalUpload = await fetch('https://www.lalal.ai/api/v1/upload/', {
      method: 'POST',
      headers: {
        'X-License-Key': process.env.LALAL_API_KEY!,
        'Content-Disposition': `attachment; filename="${headerFilename}"`,
      },
      body: fileBuffer,
    })

    if (!lalalUpload.ok) {
      const errorText = await lalalUpload.text()
      console.error('LALAL.AI upload failed:', errorText)
      await refund(admin, jobId, user.id, profile.credits)
      return NextResponse.json(
        { error: 'LALAL.AI upload failed', detail: errorText },
        { status: 500 }
      )
    }

    const uploadResult = await lalalUpload.json()
    const sourceId = uploadResult.id

    // LALAL returns the audio duration (seconds) — the authoritative source for
    // billing. One credit covers up to 6 minutes; longer tracks cost more.
    const durationSeconds = Number(uploadResult.duration) || 0
    const creditsNeeded = creditsForDuration(durationSeconds)

    // Make sure the user can actually afford this track before we kick off the
    // (paid) separation. Abort cleanly if they're short on credits.
    if (profile.credits < creditsNeeded) {
      await refund(admin, jobId, user.id, profile.credits)
      return NextResponse.json(
        {
          error: 'Not enough credits',
          detail: `This track needs ${creditsNeeded} credits but you have ${profile.credits}.`,
          creditsNeeded,
          credits: profile.credits,
        },
        { status: 402 }
      )
    }

    // 2. Start ONE vocals separation. The result contains BOTH the vocal stem
    //    and the instrumental ("back") track, so a single task is enough.
    const splitResponse = await fetch(
      'https://www.lalal.ai/api/v1/split/stem_separator/',
      {
        method: 'POST',
        headers: {
          'X-License-Key': process.env.LALAL_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_id: sourceId,
          presets: {
            stem: 'vocals',
            extraction_level: 'deep_extraction',
            splitter: 'auto',
          },
        }),
      }
    )

    if (!splitResponse.ok) {
      const errorText = await splitResponse.text()
      console.error('LALAL.AI split failed:', errorText)
      await refund(admin, jobId, user.id, profile.credits)
      return NextResponse.json(
        { error: 'LALAL.AI split failed', detail: errorText },
        { status: 500 }
      )
    }

    const splitResult = await splitResponse.json()
    const taskId = splitResult.task_id

    const { error: updateError } = await admin
      .from('jobs')
      .update({
        lalal_job_id: sourceId,
        lalal_vocal_task_id: taskId,
        status: 'analysing',
        credits_used: creditsNeeded,
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('Job update error:', updateError)
    }

    // Deduct credits (1 per started 6-minute block)
    const { error: creditError } = await admin
      .from('profiles')
      .update({ credits: profile.credits - creditsNeeded })
      .eq('id', user.id)

    if (creditError) {
      console.error('Credit deduction error:', creditError)
    }

    return NextResponse.json({ jobId, creditsUsed: creditsNeeded })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// Roll back a failed job and return the credit (it was not deducted yet here,
// but we mark the job failed so the UI reflects it).
async function refund(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  userId: string,
  currentCredits: number
) {
  await admin.from('jobs').update({ status: 'failed' }).eq('id', jobId)
}
