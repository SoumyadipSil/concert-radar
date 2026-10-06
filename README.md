# Concert Radar 🎤

A web app that tells you when artists you actually listen to announce shows near you.

Connect your Last.fm listening history, set your location, and get notified via Telegram and/or email when concerts are announced within your radius.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│  Next.js App Router (Landing, Auth, Onboarding, Dashboard)  │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                      API Routes                             │
│  /api/lastfm/import  /api/profile  /api/artists/*           │
│  /api/telegram/*     /api/geocode  /api/cron/*              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                      Core Libraries                         │
│  Providers (pluggable)  │  Notifiers (pluggable)            │
│  ┌──────────────────┐   │  ┌───────────┐  ┌──────────┐     │
│  │  Ticketmaster     │   │  │  Telegram  │  │  Email   │     │
│  └──────────────────┘   │  └───────────┘  └──────────┘     │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                    Supabase (Postgres)                       │
│  profiles │ artists │ events │ notifications │ ...          │
│  Row Level Security on every table                          │
└─────────────────────────────────────────────────────────────┘
```

### Key design decisions

- **Event sources are pluggable adapters.** Each provider implements `EventProvider` and normalizes responses into `NormalizedEvent`. Adding a source means implementing one interface and registering it.
- **Notification channels are pluggable notifiers.** Each channel implements `Notifier`. Adding a channel means one interface implementation.
- **Cache per artist, not per user.** If 50 users follow the same artist, one API call covers them all.
- **Idempotency via DB constraints.** Unique constraints on `(provider, external_id)` for events and `(user_id, event_id, kind, channel)` for notifications prevent duplicates at the database level.
- **Distance filtering uses the same haversine formula** in both Postgres (for dashboard queries) and TypeScript (for server logic), ensuring consistent results.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Database | Supabase (Postgres + Auth + RLS) |
| Styling | Tailwind CSS 4 |
| Validation | Zod |
| Testing | Vitest |
| Email | Resend |
| Notifications | Telegram Bot API |
| Scheduler | GitHub Actions cron |
| Deployment | Vercel |

## Prerequisites

- Node.js 20+
- npm
- A [Supabase](https://supabase.com) project (free tier)
- API keys (all free tier):
  - [Last.fm API key](https://www.last.fm/api/account/create)
  - [Ticketmaster Discovery API key](https://developer.ticketmaster.com/)
  - [Telegram Bot](https://core.telegram.org/bots#botfather) token
  - [Resend API key](https://resend.com/api-keys)

## Setup

### 1. Clone and install

```bash
git clone <repo-url> concert-radar
cd concert-radar
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`. See `.env.example` for descriptions of each variable.

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Run the migration against your database:
   - Go to **SQL Editor** in the Supabase dashboard.
   - Paste the contents of `supabase/migrations/00001_initial_schema.sql` and run it.
3. Copy your project URL and keys into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY` — service_role key (keep secret!)
4. Enable **Email (magic link)** and **Google** auth providers in Supabase Auth settings.

### 4. Generate Supabase types (optional, recommended)

If you have the Supabase CLI installed:

```bash
npx supabase gen types typescript --project-id <your-project-id> > src/lib/supabase/types.ts
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Run tests

```bash
npm test
```

### Try a Ticketmaster artist

Phase 2 includes a small CLI for checking an artist against the Discovery API. It
requires `TICKETMASTER_API_KEY` in `.env.local` and only accepts exact normalized
attraction-name matches, so tribute-band results are not selected.

```bash
npm run try:artist -- "Coldplay"
```

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key — **never expose to client** |
| `CRON_SECRET` | Server only | Bearer token for authenticating cron API calls |
| `LASTFM_API_KEY` | Server only | Last.fm API key |
| `TICKETMASTER_API_KEY` | Server only | Ticketmaster Discovery API key |
| `TELEGRAM_BOT_TOKEN` | Server only | Telegram Bot API token |
| `TELEGRAM_WEBHOOK_SECRET` | Server only | Secret for verifying Telegram webhook requests |
| `RESEND_API_KEY` | Server only | Resend email API key |
| `RESEND_FROM_EMAIL` | Server only | Verified sender email address |
| `NEXT_PUBLIC_APP_URL` | Client + Server | Public URL of the deployed app |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
├── components/             # React components
├── hooks/                  # Custom React hooks
└── lib/
    ├── providers/          # Event source adapters (Ticketmaster, etc.)
    │   ├── types.ts        # NormalizedEvent, EventProvider interfaces
    │   └── registry.ts     # Provider registry
    ├── notifiers/          # Notification channels (Telegram, Email)
    │   ├── types.ts        # NotificationPayload, Notifier interfaces
    │   └── registry.ts     # Notifier registry
    ├── supabase/           # Supabase client helpers
    ├── env.ts              # Zod-validated environment variables
    ├── geo.ts              # Haversine distance (mirrors Postgres function)
    ├── normalize.ts        # Artist name normalization
    ├── cron-auth.ts        # Cron route authentication
    └── constants.ts        # Configuration defaults
```

## How to Add a New Event Provider

1. Create `src/lib/providers/<name>/index.ts`
2. Implement the `EventProvider` interface (see `src/lib/providers/types.ts`)
3. Create Zod schemas for the provider's API responses in `schemas.ts`
4. Add the provider to the registry in your app's initialization
5. Add a row to `provider_health` for monitoring
6. Add test fixtures in `tests/fixtures/<name>/`
7. Write unit tests in `tests/providers/<name>.test.ts`
8. Update `.env.example` with any new API keys
9. Update this README

## Deployment

### Vercel

1. Connect your repo to Vercel.
2. Add all environment variables from `.env.example` to Vercel's project settings.
3. Deploy.

### GitHub Actions Cron

The `.github/workflows/cron.yml` workflow calls `/api/cron/ingest` and `/api/cron/notify` every 3 hours.

Add `CRON_SECRET` and `NEXT_PUBLIC_APP_URL` as GitHub Actions secrets in your repo settings.

> **Note:** On public repos, GitHub disables scheduled workflows after ~60 days with no repo activity. Use a private repo or periodically push a commit. The dashboard surfaces a warning via `provider_health` if ingestion hasn't succeeded in 12+ hours.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |
| `npm run try:artist -- "Name"` | Test Ticketmaster adapter for an artist |
| `npm run seed:demo` | Insert a demo event for notification testing |

## License

MIT
