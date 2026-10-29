import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  console.error('Run with: npx dotenv -e .env.local -- npm run seed:demo');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function seed() {
  console.log('🌱 Seeding demo event...\n');

  // Get the first user profile with a location
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, city, country_code, lat, lng, timezone')
    .not('lat', 'is', null)
    .limit(1)
    .single();

  if (profileErr || !profile) {
    console.error('❌ No profile with a location found. Complete onboarding first.');
    process.exit(1);
  }

  console.log(`👤 Found profile in ${profile.city}, ${profile.country_code}`);

  // Get a followed artist for this user
  const { data: follow, error: followErr } = await admin
    .from('followed_artists')
    .select('artist_id, artists!inner(id, name)')
    .eq('user_id', profile.id)
    .limit(1)
    .single();

  if (followErr || !follow) {
    console.error('❌ No followed artists found. Import from Last.fm or add artists first.');
    process.exit(1);
  }

  // @ts-expect-error — Supabase join typing
  const artistName: string = follow.artists.name;
  // @ts-expect-error — Supabase join typing
  const artistId: string = follow.artists.id;
  console.log(`🎤 Using artist: ${artistName}`);

  // Create a demo event near the user (same lat/lng) in 30 days
  const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const onsaleAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // On sale tomorrow

  const demoEvent = {
    provider: 'demo',
    external_id: `demo-${Date.now()}`,
    artist_id: artistId,
    title: `${artistName} Live in ${profile.city ?? 'Your City'}`,
    venue_name: 'Demo Venue',
    city: profile.city,
    country_code: profile.country_code,
    lat: profile.lat,
    lng: profile.lng,
    starts_at: startsAt.toISOString(),
    timezone: profile.timezone ?? 'UTC',
    ticket_url: 'https://example.com/tickets',
    onsale_at: onsaleAt.toISOString(),
    presales: [],
    status: 'scheduled',
    raw: { demo: true },
    first_seen_at: new Date().toISOString(),
  };

  const { data: event, error: eventErr } = await admin
    .from('events')
    .upsert(demoEvent, { onConflict: 'provider,external_id' })
    .select('id')
    .single();

  if (eventErr) {
    console.error('❌ Failed to insert demo event:', eventErr.message);
    process.exit(1);
  }

  console.log(`\n✅ Demo event created!`);
  console.log(`   Event ID: ${event.id}`);
  console.log(`   ${demoEvent.title}`);
  console.log(`   📍 ${demoEvent.venue_name}, ${demoEvent.city}`);
  console.log(`   📅 ${startsAt.toLocaleDateString()}`);
  console.log(`   🎟 On sale: ${onsaleAt.toLocaleDateString()}`);
  console.log(`\nNow trigger notifications with:`);
  console.log(`   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/notify`);
}

seed();
