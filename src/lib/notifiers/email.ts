import { serverEnv } from '@/lib/env';
import type { Notifier, NotificationPayload, Profile } from './types';

/** Escape HTML to prevent XSS in email content. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

export class EmailNotifier implements Notifier {
  readonly channel = 'email' as const;

  isConfiguredFor(profile: Profile): boolean {
    return Boolean(profile.email && profile.notify_email);
  }

  async send(profile: Profile, payload: NotificationPayload): Promise<void> {
    if (!this.isConfiguredFor(profile)) return;

    const env = serverEnv();
    const artist = escapeHtml(payload.artistName);
    const title = escapeHtml(payload.event.title);
    const venue = escapeHtml(payload.event.venue_name ?? 'Venue TBD');
    const city = escapeHtml(payload.event.city ?? '');
    const date = formatDate(payload.event.starts_at, payload.timeZoneForUser);
    const ticketUrl = payload.event.ticket_url || '';

    const kindLabel =
      payload.kind === 'onsale_reminder'
        ? '⏰ On-sale Reminder'
        : '🎤 New Concert Alert';

    const onsaleInfo = payload.event.onsale_at
      ? `<p style="margin:0 0 8px;color:#aaa;">🎟 On sale: ${escapeHtml(formatDate(payload.event.onsale_at, payload.timeZoneForUser))}</p>`
      : '';

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 16px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">${kindLabel}</p>
          <h1 style="margin:0 0 8px;font-size:24px;color:#fff;">${artist}</h1>
          <p style="margin:0 0 4px;font-size:16px;color:#ddd;">${title}</p>
          <p style="margin:0 0 4px;color:#aaa;">📍 ${venue}${city ? `, ${city}` : ''}</p>
          <p style="margin:0 0 8px;color:#aaa;">📅 ${escapeHtml(date)}</p>
          ${onsaleInfo}
          ${ticketUrl ? `<a href="${escapeHtml(ticketUrl)}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#e11d48;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Get Tickets</a>` : ''}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#555;">Concert Radar — You're receiving this because you follow ${artist}.</p>
    </td></tr>
  </table>
</body>
</html>`.trim();

    // Plain-text fallback
    const plainLines = [
      kindLabel,
      '',
      payload.artistName,
      payload.event.title,
      `${payload.event.venue_name ?? 'Venue TBD'}${city ? `, ${payload.event.city}` : ''}`,
      date,
    ];
    if (payload.event.onsale_at) {
      plainLines.push(`On sale: ${formatDate(payload.event.onsale_at, payload.timeZoneForUser)}`);
    }
    if (ticketUrl) {
      plainLines.push('', `Tickets: ${ticketUrl}`);
    }
    const text = plainLines.join('\n');

    const subject =
      payload.kind === 'onsale_reminder'
        ? `⏰ ${payload.artistName} tickets on sale soon`
        : `🎤 ${payload.artistName} — new show near you`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [profile.email],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Email send failed (${response.status}): ${errorText}`);
    }
  }
}
