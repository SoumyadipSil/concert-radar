import { serverEnv } from '@/lib/env';
import type { Notifier, NotificationPayload, Profile } from './types';

export class TelegramNotifier implements Notifier {
  readonly channel = 'telegram' as const;

  isConfiguredFor(profile: Profile): boolean {
    return Boolean(profile.telegram_chat_id && profile.notify_telegram);
  }

  async send(profile: Profile, payload: NotificationPayload): Promise<void> {
    if (!this.isConfiguredFor(profile)) {
      return;
    }

    const env = serverEnv();
    const message = [
      `🎤 ${payload.artistName}`,
      payload.event.title,
      `${payload.event.venue_name ?? 'Venue TBD'} · ${payload.event.city ?? 'Unknown city'}`,
      new Date(payload.event.starts_at ?? Date.now()).toLocaleString('en-US', {
        timeZone: payload.timeZoneForUser,
      }),
      payload.event.ticket_url ? `Tickets: ${payload.event.ticket_url}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: profile.telegram_chat_id,
        text: message,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram send failed: ${errorText || response.statusText}`);
    }

    const payloadJson = (await response.json()) as { ok?: boolean; description?: string };
    if (!payloadJson.ok) {
      throw new Error(payloadJson.description ?? 'Telegram send failed');
    }
  }
}
