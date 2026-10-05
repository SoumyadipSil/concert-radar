/** Stored event from the database (matches the `events` table shape). */
export interface StoredEvent {
  id: string;
  provider: string;
  external_id: string;
  artist_id: string;
  title: string;
  venue_name: string | null;
  city: string | null;
  country_code: string | null;
  lat: number | null;
  lng: number | null;
  starts_at: string | null;
  timezone: string | null;
  ticket_url: string;
  onsale_at: string | null;
  presales: { name: string; startsAt: string; endsAt: string | null }[];
  status: string;
  first_seen_at: string;
  updated_at: string;
}

/** Profile data needed by notifiers. */
export interface Profile {
  id: string;
  email?: string;
  city: string | null;
  country_code: string | null;
  timezone: string;
  telegram_chat_id: number | null;
  notify_telegram: boolean;
  notify_email: boolean;
}

/** Payload sent to each notifier. */
export interface NotificationPayload {
  userId: string;
  kind: 'announced' | 'onsale_reminder';
  event: StoredEvent;
  artistName: string;
  /** Format dates in this timezone for the user */
  timeZoneForUser: string;
}

/**
 * Interface that every notification channel must implement.
 * Adding a new channel (e.g. WhatsApp) means implementing this interface
 * and registering the notifier in the notifier registry.
 */
export interface Notifier {
  /** Channel identifier */
  channel: 'telegram' | 'email';
  /** Check if this channel is configured and enabled for the given profile. */
  isConfiguredFor(profile: Profile): boolean;
  /** Send a notification. Throw on failure so the caller can mark it as failed. */
  send(profile: Profile, payload: NotificationPayload): Promise<void>;
}
