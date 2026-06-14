import { NextRequest, NextResponse } from 'next/server'

// Diagnostic endpoint to check webhook configuration
export async function GET(request: NextRequest) {
  const checks = {
    stripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    supabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    environment: process.env.NODE_ENV,
  }

  return NextResponse.json({
    message: 'Webhook configuration check',
    checks,
    warnings: [
      !checks.stripeSecretKey && 'Missing STRIPE_SECRET_KEY',
      !checks.stripeWebhookSecret && 'Missing STRIPE_WEBHOOK_SECRET',
      !checks.supabaseServiceRoleKey && 'Missing SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean),
  })
}
