/** Default search radius in kilometers */
export const DEFAULT_RADIUS_KM = 100;

/** Maximum artists to process per cron ingestion run */
export const INGESTION_BATCH_SIZE = 15;

/** Hours before re-checking an artist's events */
export const ARTIST_CHECK_COOLDOWN_HOURS = 6;

/** Max notifications per user per cron run (first-run protection) */
export const MAX_NOTIFICATIONS_PER_RUN = 10;

/** Hours within which a new event triggers an 'announced' notification */
export const ANNOUNCED_WINDOW_HOURS = 48;

/** Hours before on-sale to trigger an 'onsale_reminder' */
export const ONSALE_REMINDER_HOURS = 24;

/** Maximum retries for a failed notification */
export const MAX_NOTIFICATION_RETRIES = 3;

/** Ticketmaster rate limit: max requests per second */
export const TM_MAX_REQUESTS_PER_SECOND = 4;

/** Ticketmaster rate limit: max requests per day */
export const TM_MAX_REQUESTS_PER_DAY = 5000;

/** Telegram link token expiry in minutes */
export const TELEGRAM_TOKEN_EXPIRY_MINUTES = 15;

/** Provider health: hours since last success before showing stale warning */
export const PROVIDER_STALE_HOURS = 12;

/** Earth's mean radius in km (for haversine) */
export const EARTH_RADIUS_KM = 6371;

/** Conversion factor: 1 mile = 1.60934 km */
export const KM_PER_MILE = 1.60934;
