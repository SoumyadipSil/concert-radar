import { NextResponse, type NextRequest } from 'next/server';
import { validateCronAuth } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getNotifier } from '@/lib/notifiers/registry';
import '@/lib/notifiers';
import {
  ANNOUNCED_WINDOW_HOURS,
  MAX_NOTIFICATIONS_PER_RUN,
  ONSALE_REMINDER_HOURS,
} from '@/lib/constants';
import { getEffectiveRadiusKm, isWithinRadius } from '@/lib/geo';

const toTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) {
    return authError;
  }

  try {
    const admin = createAdminClient();
    const now = Date.now();
    const announcedCutoff = new Date(now - ANNOUNCED_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const onsaleReminderCutoff = new Date(now + ONSALE_REMINDER_HOURS * 60 * 60 * 1000).toISOString();

    const { data: profiles, error: profilesError } = await (admin.from('profiles') as any)
      .select(
        'id,email,city,country_code,timezone,lat,lng,radius_km,distance_unit,telegram_chat_id,notify_telegram,notify_email'
      )
      .or('notify_telegram.eq.true,notify_email.eq.true')
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    if (profilesError) throw profilesError;

    const { data: events, error: eventsError } = await (admin.from('events') as any)
      .select(
        'id,artist_id,title,venue_name,city,country_code,lat,lng,starts_at,timezone,ticket_url,onsale_at,status,artists!inner(name)'
      )
      .gte('starts_at', announcedCutoff)
      .order('starts_at', { ascending: true })
      .limit(200);

    if (eventsError) throw eventsError;

    let sentCount = 0;

    for (const profile of profiles ?? []) {
      if (sentCount >= MAX_NOTIFICATIONS_PER_RUN) break;

      const profileLat = Number(profile.lat);
      const profileLng = Number(profile.lng);
      const radiusKm = getEffectiveRadiusKm(
        Number(profile.radius_km ?? 100),
        profile.distance_unit === 'mi' ? 'mi' : 'km'
      );

      for (const event of events ?? []) {
        if (sentCount >= MAX_NOTIFICATIONS_PER_RUN) break;
        if (event.lat == null || event.lng == null) continue;
        const eventLat = Number(event.lat);
        const eventLng = Number(event.lng);

        if (!isWithinRadius(profileLat, profileLng, eventLat, eventLng, radiusKm)) {
          continue;
        }

        const { data: follow } = await (admin.from('followed_artists') as any)
          .select('artist_id')
          .eq('user_id', profile.id)
          .eq('artist_id', event.artist_id)
          .maybeSingle();

        if (!follow) continue;

        const eventStartsAt = toTimestamp(event.starts_at);
        const eventOnsaleAt = toTimestamp(event.onsale_at);
        const kinds: Array<'announced' | 'onsale_reminder'> = [];

        if (eventStartsAt && eventStartsAt >= now && eventStartsAt >= Date.parse(announcedCutoff)) {
          kinds.push('announced');
        }

        if (
          eventOnsaleAt &&
          eventOnsaleAt >= now &&
          eventOnsaleAt <= Date.parse(onsaleReminderCutoff) &&
          eventStartsAt &&
          eventStartsAt > now
        ) {
          kinds.push('onsale_reminder');
        }

        for (const kind of kinds) {
          if (sentCount >= MAX_NOTIFICATIONS_PER_RUN) break;

          const channels: Array<'telegram' | 'email'> = [];
          if (profile.notify_telegram && profile.telegram_chat_id) channels.push('telegram');
          if (profile.notify_email && profile.email) channels.push('email');

          for (const channel of channels) {
            if (sentCount >= MAX_NOTIFICATIONS_PER_RUN) break;

            const { data: existingNotification } = await (admin.from('notifications') as any)
              .select('id')
              .eq('user_id', profile.id)
              .eq('event_id', event.id)
              .eq('kind', kind)
              .eq('channel', channel)
              .maybeSingle();

            if (existingNotification) continue;

            const notifier = getNotifier(channel);
            if (!notifier) continue;

            const payload = {
              userId: profile.id,
              kind,
              event: {
                id: event.id,
                provider: event.provider ?? 'ticketmaster',
                external_id: event.external_id ?? '',
                artist_id: event.artist_id,
                title: event.title,
                venue_name: event.venue_name,
                city: event.city,
                country_code: event.country_code,
                lat: event.lat,
                lng: event.lng,
                starts_at: event.starts_at,
                timezone: event.timezone,
                ticket_url: event.ticket_url ?? '',
                onsale_at: event.onsale_at,
                presales: [],
                status: event.status ?? 'scheduled',
                first_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              artistName: event.artists?.name ?? 'Unknown artist',
              timeZoneForUser: profile.timezone ?? 'UTC',
            };

            try {
              await notifier.send(profile, payload);
              await (admin.from('notifications') as any).insert({
                user_id: profile.id,
                event_id: event.id,
                kind,
                channel,
                status: 'sent',
                sent_at: new Date().toISOString(),
              });
              sentCount += 1;
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unable to send notification';
              await (admin.from('notifications') as any).insert({
                user_id: profile.id,
                event_id: event.id,
                kind,
                channel,
                status: 'failed',
                error: message,
                sent_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true, sent: sentCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process notification cron job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
