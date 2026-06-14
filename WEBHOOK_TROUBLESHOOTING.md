# Stripe Webhook Troubleshooting Guide

## Issue: Credits not appearing after payment

If you've purchased credits but they're not showing up in your account, the Stripe webhook is likely not working correctly. Follow these steps to diagnose and fix the issue.

## Quick Diagnosis Steps

### 1. Check Webhook Configuration Endpoint

Visit your deployed site at:
```
https://your-domain.netlify.app/api/stripe/webhook-test
```

This will show you which environment variables are configured. All checks should be `true`.

### 2. Check Stripe Dashboard

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. **Important**: Make sure you're in **LIVE MODE** (toggle in top-right)
3. Look for your webhook endpoint

#### If webhook doesn't exist:
Create it:
- Click "Add endpoint"
- URL: `https://your-domain.netlify.app/api/stripe/webhook`
- Events to send: Select `checkout.session.completed`
- Click "Add endpoint"
- Copy the signing secret (starts with `whsec_`)

#### If webhook exists:
- Click on it
- Check "Status" - should be "Enabled"
- Check "Events to send" - should include `checkout.session.completed`
- Look at "Recent deliveries" tab to see if Stripe is trying to send webhooks
  - If you see 401/403 errors → Authentication problem (check keys)
  - If you see 500 errors → Server error (check logs)
  - If you see 200 → Webhook is working! The issue is elsewhere

### 3. Verify Netlify Environment Variables

Go to: Netlify Dashboard → Your Site → Site settings → Environment variables

Required variables:
```
STRIPE_SECRET_KEY=sk_live_...           # MUST be live key, not test
STRIPE_WEBHOOK_SECRET=whsec_...         # From webhook in Stripe dashboard
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # Service role key (very long)
NEXT_PUBLIC_SUPABASE_URL=https://...    # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...    # Anon key
```

**Common mistakes:**
- Using test keys (`sk_test_...`) instead of live keys in production
- Missing `SUPABASE_SERVICE_ROLE_KEY` (webhook needs this to bypass RLS)
- Wrong webhook secret (copy from the specific webhook endpoint in Stripe)
- After changing env vars, you MUST redeploy the site for them to take effect

### 4. Check Netlify Function Logs

1. Go to: Netlify Dashboard → Your Site → Logs → Functions
2. Make a test purchase
3. Look for logs starting with `[Webhook]`
4. Common issues:
   - No logs at all → Stripe isn't sending webhooks (check step 2)
   - "STRIPE_WEBHOOK_SECRET not configured" → Add env var and redeploy
   - "Profile not found" → User profile wasn't created on signup
   - "Invalid signature" → Wrong webhook secret in env vars

### 5. Test the Payment Flow

1. Make sure you're using live Stripe keys (not test mode)
2. Buy credits using a **real payment method**
3. Immediately check:
   - Stripe Dashboard → Payments (should see successful payment)
   - Stripe Dashboard → Webhooks → Your webhook → Recent deliveries (should see new event)
   - Netlify Dashboard → Functions logs (should see webhook processing logs)
   - Your site → Profile page (credits should appear)

## Common Issues and Fixes

### Issue: "No signature in request"
**Cause**: Stripe isn't reaching your webhook endpoint
**Fix**: 
- Verify webhook URL is correct in Stripe dashboard
- Make sure your site is deployed and accessible

### Issue: "Invalid signature"
**Cause**: Wrong webhook secret
**Fix**: 
1. Go to Stripe Dashboard → Webhooks → Your webhook
2. Click "Reveal" next to "Signing secret"
3. Copy the secret (starts with `whsec_`)
4. Update `STRIPE_WEBHOOK_SECRET` in Netlify
5. Redeploy your site

### Issue: "Profile not found"
**Cause**: User profile wasn't created during signup
**Fix**: 
Check if the Supabase trigger is working:
```sql
-- Run this in Supabase SQL Editor
SELECT * FROM profiles WHERE id = 'your-user-id';
```
If empty, manually create the profile or check the `handle_new_user()` trigger.

### Issue: Webhook works but credits still don't show
**Cause**: Frontend is caching old data
**Fix**: 
1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Try in incognito mode
4. Check Supabase Dashboard → Table Editor → profiles (credits should be there)

### Issue: Test mode payments work but live mode doesn't
**Cause**: Using test keys or test webhook secret in production
**Fix**: 
- Make sure ALL keys in Netlify are live mode keys
- Create a separate webhook for live mode in Stripe
- Never use test keys in production

## Manual Credit Addition (Emergency Fix)

If you need to manually add credits while fixing the webhook:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Table Editor → profiles
4. Find the user's row (by user ID)
5. Click the "credits" cell and update the number
6. Click the checkmark to save

## Testing Webhooks Locally

To test webhooks on localhost:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward events: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
4. Copy the webhook secret that appears
5. Add to `.env.local`: `STRIPE_WEBHOOK_SECRET=whsec_...`
6. Make a test payment
7. Watch the terminal for webhook events

## Still Having Issues?

If you've tried everything above:

1. Export your Netlify function logs
2. Export Stripe webhook delivery logs (from Recent deliveries tab)
3. Check Supabase logs for any RLS policy violations
4. Verify your user ID matches between:
   - Supabase auth.users table
   - profiles table
   - The userId in the webhook metadata

## Prevention Checklist

Before going live:
- [ ] Stripe webhook created with correct URL
- [ ] Webhook subscribed to `checkout.session.completed`
- [ ] All Netlify env vars set correctly (live keys)
- [ ] Site deployed after setting env vars
- [ ] Test purchase completed successfully
- [ ] Webhook logs show successful processing
- [ ] Credits appear in user profile
- [ ] Check Recent deliveries in Stripe shows 200 responses
