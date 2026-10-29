import { serverEnv } from '@/lib/env';
import type { Notifier, NotificationPayload, Profile } from './types';

/** Escape HTML special characters to prevent injection in Telegram HTML messages. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format a date string in the user's timezone for display. */
function formatDate(isoDate: string | null, timezone: string): string {
  if (!isoDate) return 'Date TBD';
  try {
    return new Date(isoDate).toLocaleString('en-GB', {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return new Date(isoDate).toUTCString();
  }
}

export class TelegramNotifier implements Notifier {
  readonly channel = 'telegram' as const;

  isConfiguredFor(profile: Profile): boolean {
    return Boolean(profile.telegram_chat_id && profile.notify_telegram);
  }

  async send(profile: Profile, payload: NotificationPayload): Promise<void> {
    if (!this.isConfiguredFor(profile)) return;

    const env = serverEnv();
    const artist = escapeHtml(payload.artistName);
    const title = escapeHtml(payload.event.title);
    const venue = escapeHtml(payload.event.venue_name ?? 'Venue TBD');
    const city = escapeHtml(payload.event.city ?? '');
    const date = escapeHtml(formatDate(payload.event.starts_at, payload.timeZoneForUser));
    const ticketUrl = payload.event.ticket_url;

    const lines: string[] = [
      `🎤 <b>${artist}</b>`,
      title && title !== artist ? `🎶 ${title}` : '',
      `📍 ${venue}${city ? `, ${city}` : ''}`,
      `📅 ${date}`,
    ].filter(Boolean);

    if (payload.event.onsale_at) {
      const onsale = escapeHtml(formatDate(payload.event.onsale_at, payload.timeZoneForUser));
      lines.push(`🎟 On sale: ${onsale}`);
    }

    if (ticketUrl) {
      lines.push(`\n<a href="${escapeHtml(ticketUrl)}">Get tickets</a>`);
    }

    if (payload.kind === 'onsale_reminder') {
      lines.unshift('⏰ <b>On-sale reminder</b>');
    }

    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: profile.telegram_chat_id,
          text: lines.join('\n'),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram send failed (${response.status}): ${errorText}`);
    }

    const result = (await response.json()) as { ok?: boolean; description?: string };
    if (!result.ok) {
      throw new Error(result.description ?? 'Telegram send failed');
    }
  }
}
