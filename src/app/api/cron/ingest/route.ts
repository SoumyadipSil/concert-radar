import { NextResponse, type NextRequest } from 'next/server';
import { validateCronAuth } from '@/lib/cron-auth';
import { createTicketmasterProvider } from '@/lib/providers/ticketmaster';
import { getProvider, registerProvider } from '@/lib/providers/registry';
import { createAdminClient } from '@/lib/supabase/admin';
import { INGESTION_BATCH_SIZE, ARTIST_CHECK_COOLDOWN_HOURS } from '@/lib/constants';

export const maxDuration = 55;

export async function POST(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  const admin = createAdminClient();
  const provider = getProvider('ticketmaster') ?? (() => {
    const p = createTicketmasterProvider();
    registerProvider(p);
    return p;
  })();

  const cooldownCutoff = new Date(
    Date.now() - ARTIST_CHECK_COOLDOWN_HOURS * 60 * 60 * 1000
  ).toISOString();

  // Get artists followed by at least 1 user, not checked recently
  // Using a raw query approach: get followed artist IDs, then fetch the artists
  const { data: followedRows, error: followErr } = await admin
    .from('followed_artists')
    .select('artist_id');

  if (followErr) {
    return NextResponse.json({ error: followErr.message }, { status: 500 });
  }

  const followedIds = [...new Set((followedRows ?? []).map((r) => r.artist_id))];
  if (followedIds.length === 0) {
    return NextResponse.json({ ok: true, artists_checked: 0, events_upserted: 0, errors: [] });
  }

  const { data: artists, error: artistErr } = await admin
    .from('artists')
    .select('id, name, normalized_name, mbid, last_checked_at')
    .in('id', followedIds)
    .or(`last_checked_at.is.null,last_checked_at.lt.${cooldownCutoff}`)
    .limit(INGESTION_BATCH_SIZE);

  if (artistErr) {
    return NextResponse.json({ error: artistErr.message }, { status: 500 });
  }

  let eventsUpserted = 0;
  const errors: Array<{ artist: string; error: string }> = [];

  for (const artist of artists ?? []) {
    try {
      // Check cached provider artist ID
      const { data: cached } = await admin
        .from('artist_external_ids')
        .select('external_id')
        .eq('artist_id', artist.id)
        .eq('provider', provider.id)
        .maybeSingle();

      let providerArtistId = cached?.external_id ?? null;

      if (!cached) {
        // Not yet resolved — resolve now
        providerArtistId = await provider.resolveArtist(artist.name, artist.mbid ?? undefined);

        // Cache the result (even null means "looked up, not found")
        await admin.from('artist_external_ids').upsert(
          {
            artist_id: artist.id,
            provider: provider.id,
            external_id: providerArtistId,
            resolved_at: new Date().toISOString(),
          },
          { onConflict: 'artist_id,provider' }
        );
      }

      if (providerArtistId) {
        const events = await provider.fetchEventsForArtist(providerArtistId);

        for (const event of events) {
          const { error: upsertErr } = await admin.from('events').upsert(
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
              ticket_url: event.ticketUrl || '',
              onsale_at: event.onsaleAt,
              presales: event.presales as unknown as import('@/lib/supabase/types').Json,
              status: event.status,
              raw: event.raw as unknown as import('@/lib/supabase/types').Json,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'provider,external_id' }
          );

          if (!upsertErr) eventsUpserted += 1;
        }
      }

      // Mark artist as checked
      await admin
        .from('artists')
        .update({ last_checked_at: new Date().toISOString() })
        .eq('id', artist.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ artist: artist.name, error: message });
    }
  }

  // Update provider health
  if (errors.length === 0) {
    await admin.from('provider_health').upsert(
      {
        provider: provider.id,
        last_success_at: new Date().toISOString(),
        consecutive_failures: 0,
        last_error: null,
        last_error_at: null,
      },
      { onConflict: 'provider' }
    );
  } else {
    // Partial success: record the last error but also update success time
    await admin.from('provider_health').upsert(
      {
        provider: provider.id,
        last_success_at: (artists ?? []).length > errors.length ? new Date().toISOString() : undefined,
        last_error: errors[errors.length - 1].error,
        last_error_at: new Date().toISOString(),
        consecutive_failures: errors.length,
      },
      { onConflict: 'provider' }
    );
  }

  return NextResponse.json({
    ok: true,
    artists_checked: (artists ?? []).length,
    events_upserted: eventsUpserted,
    errors,
  });
}
