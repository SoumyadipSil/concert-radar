import { serverEnv } from '@/lib/env';
import type { Notifier, NotificationPayload, Profile } from './types';

export class EmailNotifier implements Notifier {
  readonly channel = 'email' as const;

  isConfiguredFor(profile: Profile): boolean {
    return Boolean(profile.email && profile.notify_email);
  }

  async send(profile: Profile, payload: NotificationPayload): Promise<void> {
    if (!this.isConfiguredFor(profile)) {
      return;
    }

    const env = serverEnv();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [profile.email],
        subject: `${payload.artistName} has a new concert near you`,
        html: `
          <h2>${payload.artistName}</h2>
          <p><strong>${payload.event.title}</strong></p>
          <p>${payload.event.venue_name ?? 'Venue TBD'} · ${payload.event.city ?? 'Unknown city'}</p>
          <p>${new Date(payload.event.starts_at ?? Date.now()).toLocaleString('en-US', { timeZone: payload.timeZoneForUser })}</p>
          <p><a href="${payload.event.ticket_url || '#'}">View tickets</a></p>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Email send failed: ${errorText || response.statusText}`);
    }
  }
}
