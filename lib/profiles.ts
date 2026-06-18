import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

type ProfileResult = {
  data: Profile | null
  error: PostgrestError | null
}

export async function getOrCreateProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ProfileResult> {
  const { data: existingProfile, error: lookupError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (lookupError) {
    return { data: null, error: lookupError }
  }

  if (existingProfile) {
    return { data: existingProfile, error: null }
  }

  const { data: createdProfile, error: createError } = await supabase
    .from('profiles')
    .insert({ id: userId, credits: 0 })
    .select('*')
    .single()

  if (!createError) {
    return { data: createdProfile, error: null }
  }

  // Another request may have created the row between lookup and insert.
  if (createError.code === '23505') {
    const { data: recoveredProfile, error: recoveryError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    return { data: recoveredProfile, error: recoveryError }
  }

  return { data: null, error: createError }
}
