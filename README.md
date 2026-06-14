# Havdolo - Jewish Music Vocal Remover

The first AI stem separator built specifically for Jewish music.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **Payment**: Stripe
- **AI Processing**: LALAL.AI API v1
- **Audio Visualization**: WaveSurfer.js

## Setup Instructions

### 1. Database Setup

Run the following SQL in your Supabase SQL Editor to create the necessary tables:

```sql
-- Create profiles table
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  credits integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create jobs table
create table jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  lalal_job_id text not null default '',
  lalal_vocal_task_id text,
  lalal_instrumental_task_id text,
  status text not null,
  original_filename text not null,
  vocal_url text,
  instrumental_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create credit_purchases table
create table credit_purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  stripe_session_id text not null,
  credits_purchased integer not null,
  amount_gbp numeric(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table jobs enable row level security;
alter table credit_purchases enable row level security;

-- Profiles policies
create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Jobs policies
create policy "Users can view their own jobs"
  on jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own jobs"
  on jobs for insert
  with check (auth.uid() = user_id);

-- Credit purchases policies
create policy "Users can view their own purchases"
  on credit_purchases for select
  using (auth.uid() = user_id);

-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, credits)
  values (new.id, 0);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 2. Storage Setup

Create a storage bucket in Supabase called `tracks`:

1. Go to Supabase Dashboard → Storage
2. Create new bucket named `tracks`
3. Make it private (not public)
4. Set the following policy:

```sql
-- Allow authenticated users to upload to their own folder
create policy "Users can upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'tracks' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to read their own files
create policy "Users can read their own files"
  on storage.objects for select
  using (
    bucket_id = 'tracks' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 3. Environment Variables

Your `.env.local` file is already configured with:
- Supabase credentials ✓
- LALAL.AI API key ✓
- Stripe keys (add these):

Get your Stripe keys from https://dashboard.stripe.com/test/apikeys and add them to `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

For the webhook secret, you'll need to:
1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. Copy the webhook signing secret that starts with `whsec_`
4. Add it to `.env.local` as `STRIPE_WEBHOOK_SECRET`

#### Email Configuration (for Contact Form)

To enable the contact form to send emails, add these to `.env.local`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
CONTACT_EMAIL=contact@yourdomain.com
```

**For Gmail users:**
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an App Password: https://myaccount.google.com/apppasswords
4. Use the generated app password as `SMTP_PASS`

**For other email providers:**
- Check your provider's SMTP settings documentation
- Update `SMTP_HOST`, `SMTP_PORT`, and `SMTP_SECURE` accordingly

### 4. Supabase Auth Configuration

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set Site URL to: `http://localhost:3000`
3. Add Redirect URL: `http://localhost:3000/auth/callback`

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **Upload Page** (`/`): Drag-and-drop or browse to upload audio files (MP3, WAV, FLAC up to 20MB)
- **Auth Page** (`/auth`): Sign up / Sign in with email and password
- **Processing Page** (`/processing/[jobId]`): Real-time status tracking with 4-step progress
- **Results Page** (`/results/[jobId]`): Play, visualize, and download separated vocals and instrumental tracks
- **Credits Page** (`/credits`): Purchase credit packs via Stripe
- **Contact Form**: Pop-up contact form in footer that sends emails directly to your inbox
- **Middleware**: Protects all routes except `/` and `/auth`

## API Routes

- `POST /api/upload` - Receives the Supabase Storage path of a browser-uploaded file, then forwards it to LALAL.AI and creates the processing job
- `GET /api/job/[jobId]` - Poll job status and fetch results
- `POST /api/stripe/checkout` - Create Stripe checkout session
- `POST /api/stripe/webhook` - Handle Stripe webhook events
- `POST /api/contact` - Send contact form emails
- `GET /auth/callback` - Supabase auth callback

## Deploying to Netlify

This app is configured for Netlify via `netlify.toml` and the official
`@netlify/plugin-nextjs` runtime (SSR, API routes, and middleware all work).

### 1. Connect the repo

1. Push this project to GitHub/GitLab/Bitbucket.
2. In Netlify, **Add new site → Import an existing project** and pick the repo.
3. Build settings are picked up automatically from `netlify.toml`
   (build command `npm run build`, Node 20).

### 2. Environment variables

In **Site settings → Environment variables**, add every key from
`.env.local.example` with your **production** values:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — server only |
| `LALAL_API_KEY` | Secret |
| `STRIPE_SECRET_KEY` | Use the **live** key (`sk_live_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Live publishable key (`pk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | From the production webhook (below) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `CONTACT_EMAIL` | Contact form |

### 3. Supabase Auth URLs

In **Supabase → Authentication → URL Configuration**:
- Site URL: `https://your-domain.com`
- Redirect URL: `https://your-domain.com/auth/callback`

### 4. Stripe production webhook

1. In the Stripe Dashboard (live mode) create a webhook endpoint:
   `https://your-domain.com/api/stripe/webhook`
2. Subscribe to the `checkout.session.completed` event.
3. Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` on Netlify.

### 5. Storage policies (required)

The 20MB upload limit exists because **files are uploaded directly from the
browser to Supabase Storage**, not through serverless functions (Netlify
functions have a hard ~4.5MB request limit). For this to work, the `tracks`
bucket policies from the [Storage Setup](#2-storage-setup) section above **must**
be in place so authenticated users can upload to their own `{userId}/...` folder.

### Why 20MB?

Netlify/AWS Lambda caps serverless request bodies at ~4.5MB (binary). Uploading
straight to Supabase Storage sidesteps that limit entirely; we cap at 20MB on
both the client and the server (`/api/upload`) to keep processing fast and
predictable for all users.

## Credits System

- Users start with 0 free credits
- Each separation job costs 1 credit
- Credit packs:
  - Starter: 10 credits - £9.99
  - Producer: 50 credits - £39.99
  - Studio: 150 credits - £99.99

## Support

For issues or questions, contact support at your-email@example.com
