import { NextResponse, type NextRequest } from 'next/server';
import { validateCronAuth } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAllNotifiers } from '@/lib/notifiers/registry';
import '@/lib/notifiers';
import {
  ANNOUNCED_WINDOW_HOURS,
  MAX_NOTIFICATIONS_PER_RUN,
  MAX_NOTIFICATION_RETRIES,
  ONSALE_REMINDER_HOURS,
} from '@/lib/constants';
import { getEffectiveRadiusKm, isWithinRadius } from '@/lib/geo';
import type { NotificationPayload, Profile } from '@/lib/notifiers/types';

export const maxDuration = 55;

export async function POST(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const announcedCutoff = new Date(now - ANNOUNCED_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const onsaleWindow = new Date(now + ONSALE_REMINDER_HOURS * 60 * 60 * 1000).toISOString();

  // Get all profiles with at least one notification channel enabled and a location set
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, city, country_code, timezone, lat, lng, radius_km, distance_unit, telegram_chat_id, notify_telegram, notify_email')
    .or('notify_telegram.eq.true,notify_email.eq.true')
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  // Get recent events (not cancelled, in the future)
  const { data: events, error: eventsError } = await admin
    .from('events')
    .select('id, provider, external_id, artist_id, title, venue_name, city, country_code, lat, lng, starts_at, timezone, ticket_url, onsale_at, presales, status, first_seen_at, updated_at')
    .neq('status', 'cancelled')
    .gte('starts_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(500);

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  // Get artist names for event display
  const artistIds = [...new Set((events ?? []).map((e) => e.artist_id))];
  const artistNameMap = new Map<string, string>();
  if (artistIds.length > 0) {
    const { data: artists } = await admin
      .from('artists')
      .select('id, name')
      .in('id', artistIds);
    for (const a of artists ?? []) {
      artistNameMap.set(a.id, a.name);
    }
  }

  // Also retry previously failed notifications (up to MAX_NOTIFICATION_RETRIES)
  const { data: failedNotifications } = await admin
    .from('notifications')
    .select('id, user_id, event_id, kind, channel, error')
    .eq('status', 'failed')
    .limit(50);

  let totalSent = 0;
  let totalFailed = 0;
  const notifiers = getAllNotifiers();

  for (const profile of profiles ?? []) {
    const profileLat = Number(profile.lat);
    const profileLng = Number(profile.lng);
    const radiusKm = getEffectiveRadiusKm(
      profile.radius_km ?? 100,
      profile.distance_unit === 'mi' ? 'mi' : 'km'
    );

    // Get this user's followed artists
    const { data: follows } = await admin
      .from('followed_artists')
      .select('artist_id')
      .eq('user_id', profile.id);

    const followedArtistIds = new Set((follows ?? []).map((f) => f.artist_id));
    if (followedArtistIds.size === 0) continue;

    // Get user email from auth
    let userEmail: string | undefined;
    if (profile.notify_email) {
      const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
      userEmail = authUser?.user?.email ?? undefined;
    }

    const profileForNotifier: Profile = {
      id: profile.id,
      email: userEmail,
      city: profile.city,
      country_code: profile.country_code,
      timezone: profile.timezone ?? 'UTC',
      telegram_chat_id: profile.telegram_chat_id ? Number(profile.telegram_chat_id) : null,
      notify_telegram: profile.notify_telegram,
      notify_email: profile.notify_email,
    };

    let userSentCount = 0;
    let userSkippedCount = 0;

    for (const event of events ?? []) {
      if (!followedArtistIds.has(event.artist_id)) continue;
      if (event.lat == null || event.lng == null) continue;

      if (!isWithinRadius(profileLat, profileLng, Number(event.lat), Number(event.lng), radiusKm)) {
        continue;
      }

      // Determine which notification kinds apply
      const kinds: Array<'announced' | 'onsale_reminder'> = [];

      const firstSeenAt = event.first_seen_at ? Date.parse(event.first_seen_at) : 0;
      if (firstSeenAt >= Date.parse(announcedCutoff)) {
        kinds.push('announced');
      }

      const onsaleAt = event.onsale_at ? Date.parse(event.onsale_at) : null;
      if (onsaleAt && onsaleAt >= now && onsaleAt <= Date.parse(onsaleWindow)) {
        kinds.push('onsale_reminder');
      }

      // Also check presales
      if (!kinds.includes('onsale_reminder') && Array.isArray(event.presales)) {
        for (const presale of event.presales as Array<{ startsAt?: string }>) {
          const presaleStart = presale.startsAt ? Date.parse(presale.startsAt) : null;
          if (presaleStart && presaleStart >= now && presaleStart <= Date.parse(onsaleWindow)) {
            kinds.push('onsale_reminder');
            break;
          }
        }
      }

      for (const kind of kinds) {
        for (const notifier of notifiers) {
          if (!notifier.isConfiguredFor(profileForNotifier)) continue;

          // First-run protection: cap per user
          if (userSentCount >= MAX_NOTIFICATIONS_PER_RUN) {
            userSkippedCount += 1;
            continue;
          }

          // INSERT-FIRST idempotency: try inserting the notification row.
          // The unique constraint (user_id, event_id, kind, channel) prevents duplicates.
          const { data: inserted, error: insertErr } = await admin
            .from('notifications')
            .insert({
              user_id: profile.id,
              event_id: event.id,
              kind,
              channel: notifier.channel,
              status: 'sent' as const,
              sent_at: new Date().toISOString(),
            })
            .select('id')
            .maybeSingle();

          // If insert failed due to unique constraint, skip (already notified)
          if (insertErr || !inserted) continue;

          const payload: NotificationPayload = {
            userId: profile.id,
            kind,
            event: {
              ...event,
              presales: (event.presales ?? []) as NotificationPayload['event']['presales'],
            },
            artistName: artistNameMap.get(event.artist_id) ?? 'Unknown Artist',
            timeZoneForUser: profile.timezone ?? 'UTC',
          };

          try {
            await notifier.send(profileForNotifier, payload);
            userSentCount += 1;
            totalSent += 1;
          } catch (err) {
            // Mark as failed
            await admin
              .from('notifications')
              .update({
                status: 'failed' as const,
                error: err instanceof Error ? err.message : 'Send failed',
              })
              .eq('id', inserted.id);
            totalFailed += 1;
          }
        }
      }
    }

    // If we skipped notifications due to first-run cap, send a summary
    if (userSkippedCount > 0) {
      for (const notifier of notifiers) {
        if (!notifier.isConfiguredFor(profileForNotifier)) continue;
        try {
          // Send a summary as a "fake" announced notification
          const summaryPayload: NotificationPayload = {
            userId: profile.id,
            kind: 'announced',
            event: {
              id: 'summary',
              provider: 'system',
              external_id: 'summary',
              artist_id: '',
              title: `+${userSkippedCount} more shows near you`,
              venue_name: null,
              city: profile.city,
              country_code: profile.country_code,
              lat: null,
              lng: null,
              starts_at: null,
              timezone: null,
              ticket_url: process.env.NEXT_PUBLIC_APP_URL ?? '',
              onsale_at: null,
              presales: [],
              status: 'scheduled',
              first_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            artistName: 'Multiple Artists',
            timeZoneForUser: profile.timezone ?? 'UTC',
          };
          await notifier.send(profileForNotifier, summaryPayload);
        } catch {
          // Best effort for summary
        }
      }
    }
  }

  // Retry previously failed notifications
  let retried = 0;
  for (const failed of failedNotifications ?? []) {
    // Check retry count by looking at how many failed entries exist
    const { count } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', failed.user_id)
      .eq('event_id', failed.event_id)
      .eq('kind', failed.kind)
      .eq('channel', failed.channel)
      .eq('status', 'failed');

    if ((count ?? 0) >= MAX_NOTIFICATION_RETRIES) continue;

    // Delete the failed row and re-insert (will be picked up on next run naturally)
    await admin.from('notifications').delete().eq('id', failed.id);
    retried += 1;
  }

  return NextResponse.json({
    ok: true,
    sent: totalSent,
    failed: totalFailed,
    retried,
  });
}
