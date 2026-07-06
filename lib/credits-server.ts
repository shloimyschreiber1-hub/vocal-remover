import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type AdjustResult = {
  credits: number | null
  error: string | null
}

// Atomically add (positive) or subtract (negative) credits from a profile.
//
// PostgREST can't express `credits = credits + n` in a single statement, so we
// use optimistic concurrency (compare-and-swap): read the current balance, then
// only write the new value if the balance hasn't changed in the meantime. If a
// concurrent request slipped in, we retry. This prevents the lost-update race
// that a plain read-modify-write (`credits: profile.credits - n`) would cause.
export async function adjustCredits(
  admin: SupabaseClient<Database>,
  userId: string,
  delta: number,
  opts: { requireNonNegative?: boolean } = {}
): Promise<AdjustResult> {
  const { requireNonNegative = false } = opts

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: profile, error: readError } = await admin
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single()

    if (readError || !profile) {
      return { credits: null, error: readError?.message || 'Profile not found' }
    }

    const current = profile.credits
    const next = current + delta

    if (requireNonNegative && next < 0) {
      return { credits: current, error: 'INSUFFICIENT_CREDITS' }
    }

    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update({ credits: next })
      .eq('id', userId)
      .eq('credits', current) // CAS guard: only if unchanged since read
      .select('credits')
      .maybeSingle()

    if (updateError) {
      return { credits: null, error: updateError.message }
    }

    if (updated) {
      return { credits: updated.credits, error: null }
    }

    // Balance changed underneath us — loop and retry with the fresh value.
  }

  return { credits: null, error: 'CONFLICT' }
}
