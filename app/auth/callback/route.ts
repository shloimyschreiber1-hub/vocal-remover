import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const origin = requestUrl.origin

  if (error) {
    const message = errorDescription || error
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(message)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/auth?error=${encodeURIComponent(exchangeError.message)}`
      )
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
