/** Canonical event shape — all providers normalize to this. */
export interface NormalizedEvent {
  /** Provider identifier, e.g. 'ticketmaster' */
  provider: string;
  /** Provider's unique event ID */
  externalId: string;
  /** Artist name as reported by the provider */
  artistName: string;
  /** Event title / headline */
  title: string;
  /** Venue name, if known */
  venueName: string | null;
  /** City where the venue is located */
  city: string | null;
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string | null;
  /** Venue latitude */
  lat: number | null;
  /** Venue longitude */
  lng: number | null;
  /** Event start time in ISO 8601 UTC */
  startsAt: string | null;
  /** IANA timezone of the venue (e.g. 'America/New_York') */
  timezone: string | null;
  /** URL to purchase tickets */
  ticketUrl: string;
  /** Public on-sale start in ISO 8601 UTC */
  onsaleAt: string | null;
  /** Presale windows */
  presales: Presale[];
  /** Current event status */
  status: 'scheduled' | 'cancelled' | 'postponed' | 'rescheduled';
  /** Original API payload for debugging */
  raw: unknown;
}

export interface Presale {
  name: string;
  startsAt: string;
  endsAt: string | null;
}

/**
 * Interface that every event source adapter must implement.
 * Adding a new source (e.g. BookMyShow) means implementing this interface
 * and registering the adapter in the provider registry.
 */
export interface EventProvider {
  /** Unique provider identifier (e.g. 'ticketmaster') */
  id: string;
  /** ISO country codes this provider covers, or '*' for global */
  supportedCountries: string[] | '*';
  /** Resolve an artist name to this provider's internal artist ID. Returns null if not found. */
  resolveArtist(name: string, mbid?: string): Promise<string | null>;
  /** Fetch upcoming events for a resolved provider artist ID. */
  fetchEventsForArtist(providerArtistId: string): Promise<NormalizedEvent[]>;
}
