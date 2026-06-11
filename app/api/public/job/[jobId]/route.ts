import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Public, read-only endpoint backing the shareable results page. It returns
// only the fields needed to render a completed separation — never anything
// user-identifying. No auth is required so links can be opened by anyone.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    const admin = createAdminClient()

    const { data: job, error } = await admin
      .from('jobs')
      .select('status, original_filename, vocal_url, instrumental_url')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      status: job.status,
      original_filename: job.original_filename,
      vocal_url: job.vocal_url,
      instrumental_url: job.instrumental_url,
    })
  } catch (error) {
    console.error('Public job fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
