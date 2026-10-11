import { NextResponse, type NextRequest } from 'next/server';
import { validateCronAuth } from '@/lib/cron-auth';
import { createTicketmasterProvider } from '@/lib/providers/ticketmaster';
import { getProvider, registerProvider } from '@/lib/providers/registry';
import { createAdminClient } from '@/lib/supabase/admin';
import { INGESTION_BATCH_SIZE } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) {
    return authError;
  }

  try {
    const admin = createAdminClient();
    const provider = getProvider('ticketmaster') ?? createTicketmasterProvider();
    if (!getProvider('ticketmaster')) {
      registerProvider(provider);
    }

    const { data: followedArtists, error: followLookupError } = await (admin.from('followed_artists') as any)
      .select('artist_id, artists!inner(id, name, normalized_name, mbid, last_checked_at)')
      .order('created_at', { ascending: true })
      .limit(INGESTION_BATCH_SIZE);

    if (followLookupError) {
      throw followLookupError;
    }

    const uniqueArtists = new Map<string, any>();
    for (const row of followedArtists ?? []) {
      const artist = row.artists;
      if (!artist || uniqueArtists.has(artist.id)) continue;
      uniqueArtists.set(artist.id, artist);
    }

    let processed = 0;

    for (const artist of uniqueArtists.values()) {
      const providerArtistId = await provider.resolveArtist(artist.name);
      if (!providerArtistId) continue;

      await (admin.from('artist_external_ids') as any).upsert(
        {
          artist_id: artist.id,
          provider: provider.id,
          external_id: providerArtistId,
        },
        { onConflict: 'artist_id,provider' }
      );

      const events = await provider.fetchEventsForArtist(providerArtistId);

      for (const event of events) {
        await (admin.from('events') as any).upsert(
          {
            provider: event.provider,
            external_id: event.externalId,
            artist_id: artist.id,
            title: event.title,
            venue_name: event.venueName,
            city: event.city,
            country_code: event.countryCode,
            lat: event.lat,
            lng: event.lng,
            starts_at: event.startsAt,
            timezone: event.timezone,
            ticket_url: event.ticketUrl ?? '',
            onsale_at: event.onsaleAt,
            presales: event.presales ?? [],
            status: event.status,
            raw: event.raw ?? {},
          },
          { onConflict: 'provider,external_id' }
        );
      }

      await (admin.from('artists') as any)
        .update({ last_checked_at: new Date().toISOString() })
        .eq('id', artist.id);

      processed += 1;
    }

    await (admin.from('provider_health') as any).upsert(
      {
        provider: provider.id,
        last_success_at: new Date().toISOString(),
        consecutive_failures: 0,
      },
      { onConflict: 'provider' }
    );

    return NextResponse.json({ ok: true, processed, provider: provider.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to ingest provider events';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
