-- Concert Radar: Initial Schema
-- Migration: 00001_initial_schema

-- =============================================================================
-- Haversine distance function (shared by dashboard queries and notify job)
-- =============================================================================
create or replace function haversine_distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) returns double precision as $$
declare
  r constant double precision := 6371; -- Earth's mean radius in km
  dlat double precision;
  dlng double precision;
  a double precision;
  c double precision;
begin
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat / 2) ^ 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ^ 2;
  c := 2 * asin(sqrt(a));
  return r * c;
end;
$$ language plpgsql immutable;

-- =============================================================================
-- Tables
-- =============================================================================

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  country_code text,
  city text,
  lat double precision,
  lng double precision,
  radius_km int not null default 100,
  distance_unit text not null default 'km' check (distance_unit in ('km','mi')),
  timezone text not null default 'UTC',
  lastfm_username text,
  telegram_chat_id bigint,
  notify_telegram boolean not null default false,
  notify_email boolean not null default true,
  created_at timestamptz not null default now()
);

create table artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  mbid text unique,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index artists_normalized_name_idx on artists (normalized_name) where mbid is null;

create table artist_external_ids (
  artist_id uuid references artists on delete cascade,
  provider text not null,
  external_id text,
  resolved_at timestamptz not null default now(),
  primary key (artist_id, provider)
);

create table followed_artists (
  user_id uuid references profiles on delete cascade,
  artist_id uuid references artists on delete cascade,
  source text not null check (source in ('lastfm','manual')),
  playcount int,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  artist_id uuid not null references artists on delete cascade,
  title text not null,
  venue_name text,
  city text,
  country_code text,
  lat double precision,
  lng double precision,
  starts_at timestamptz,
  timezone text,
  ticket_url text not null,
  onsale_at timestamptz,
  presales jsonb not null default '[]',
  status text not null default 'scheduled',
  raw jsonb,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index events_artist_idx on events (artist_id, starts_at);
create index events_country_idx on events (country_code, starts_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  event_id uuid not null references events on delete cascade,
  kind text not null check (kind in ('announced','onsale_reminder')),
  channel text not null check (channel in ('telegram','email')),
  status text not null default 'sent' check (status in ('sent','failed')),
  error text,
  sent_at timestamptz not null default now(),
  unique (user_id, event_id, kind, channel)
);

create table provider_health (
  provider text primary key,
  last_success_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  consecutive_failures int not null default 0
);

create table telegram_link_tokens (
  token text primary key,
  user_id uuid not null references profiles on delete cascade,
  expires_at timestamptz not null
);

-- =============================================================================
-- Row Level Security
-- =============================================================================

-- profiles: users can read and update their own row
alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- artists: all authenticated users can read; only service role can write
alter table artists enable row level security;

create policy "Authenticated users can read artists"
  on artists for select
  to authenticated
  using (true);

-- artist_external_ids: all authenticated users can read; only service role can write
alter table artist_external_ids enable row level security;

create policy "Authenticated users can read artist external IDs"
  on artist_external_ids for select
  to authenticated
  using (true);

-- followed_artists: users can manage their own follows
alter table followed_artists enable row level security;

create policy "Users can view own follows"
  on followed_artists for select
  using (auth.uid() = user_id);

create policy "Users can insert own follows"
  on followed_artists for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own follows"
  on followed_artists for delete
  using (auth.uid() = user_id);

-- events: all authenticated users can read
alter table events enable row level security;

create policy "Authenticated users can read events"
  on events for select
  to authenticated
  using (true);

-- notifications: server-only writes; users can read their own
alter table notifications enable row level security;

create policy "Users can view own notifications"
  on notifications for select
  using (auth.uid() = user_id);

-- provider_health: server-only writes; authenticated users can read (for dashboard staleness check)
alter table provider_health enable row level security;

create policy "Authenticated users can read provider health"
  on provider_health for select
  to authenticated
  using (true);

-- telegram_link_tokens: server-only (no user access needed)
alter table telegram_link_tokens enable row level security;
