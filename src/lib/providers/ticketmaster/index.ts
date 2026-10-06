import { serverEnv } from '@/lib/env';
import { TM_MAX_REQUESTS_PER_SECOND } from '@/lib/constants';
import { artistNamesMatch } from '@/lib/normalize';
import type { EventProvider, NormalizedEvent, Presale } from '../types';
import {
  ticketmasterAttractionsResponseSchema,
  ticketmasterEventsResponseSchema,
  type TicketmasterEvent,
} from './schemas';

const API_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';
const REQUEST_INTERVAL_MS = Math.ceil(1000 / TM_MAX_REQUESTS_PER_SECOND);
const MAX_RETRIES = 3;

type FetchLike = typeof fetch;

function nullableNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function statusFromCode(
  code: string | undefined
): NormalizedEvent['status'] {
  switch (code?.toLowerCase()) {
    case 'cancelled':
      return 'cancelled';
    case 'postponed':
      return 'postponed';
    case 'rescheduled':
      return 'rescheduled';
    default:
      return 'scheduled';
  }
}

function presalesFor(event: TicketmasterEvent): Presale[] {
  return (event.sales?.presales ?? [])
    .map((presale) => {
      const startsAt = toIso(presale.startDateTime);
      if (!startsAt) return null;
      return {
        name: presale.name ?? 'Presale',
        startsAt,
        endsAt: toIso(presale.endDateTime),
      };
    })
    .filter((presale): presale is Presale => presale !== null);
}

export class TicketmasterProvider implements EventProvider {
  readonly id = 'ticketmaster';
  readonly supportedCountries = '*';

  private nextRequestAt = 0;
  private readonly artistNames = new Map<string, string>();

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch
  ) {
    if (!apiKey.trim()) throw new Error('Ticketmaster API key is required');
  }

  async resolveArtist(name: string): Promise<string | null> {
    const url = new URL(`${API_BASE_URL}/attractions.json`);
    url.searchParams.set('keyword', name);
    url.searchParams.set('classificationName', 'music');
    url.searchParams.set('apikey', this.apiKey);

    const payload = await this.requestJson(url);
    const parsed = ticketmasterAttractionsResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid Ticketmaster attractions response: ${parsed.error.message}`);
    }

    const match = parsed.data._embedded?.attractions.find((attraction) =>
      artistNamesMatch(name, attraction.name)
    );
    if (!match) return null;

    this.artistNames.set(match.id, match.name);
    return match.id;
  }

  async fetchEventsForArtist(providerArtistId: string): Promise<NormalizedEvent[]> {
    const url = new URL(`${API_BASE_URL}/events.json`);
    url.searchParams.set('attractionId', providerArtistId);
    url.searchParams.set('sort', 'date,asc');
    url.searchParams.set('size', '50');
    url.searchParams.set('apikey', this.apiKey);

    const payload = await this.requestJson(url);
    const parsed = ticketmasterEventsResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid Ticketmaster events response: ${parsed.error.message}`);
    }

    const fallbackArtistName = this.artistNames.get(providerArtistId) ?? providerArtistId;
    return (parsed.data._embedded?.events ?? []).map((event) =>
      this.normalizeEvent(event, fallbackArtistName)
    );
  }

  private normalizeEvent(event: TicketmasterEvent, fallbackArtistName: string): NormalizedEvent {
    const venue = event._embedded?.venues[0];
    const attraction = event._embedded?.attractions[0];

    return {
      provider: this.id,
      externalId: event.id,
      artistName: attraction?.name ?? fallbackArtistName,
      title: event.name,
      venueName: venue?.name ?? null,
      city: venue?.city?.name ?? null,
      countryCode: venue?.country?.countryCode ?? null,
      lat: nullableNumber(venue?.location?.latitude),
      lng: nullableNumber(venue?.location?.longitude),
      startsAt: toIso(event.dates?.start?.dateTime),
      timezone: event.dates?.start?.timezone ?? null,
      ticketUrl: event.url ?? '',
      onsaleAt: toIso(event.sales?.public?.startDateTime),
      presales: presalesFor(event),
      status: statusFromCode(event.dates?.status?.code),
      raw: event,
    };
  }

  private async requestJson(url: URL): Promise<unknown> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      await this.waitForRateLimit();
      const response = await this.fetchImpl(url);

      if (response.ok) return response.json();
      if (response.status !== 429 || attempt === MAX_RETRIES) {
        throw new Error(`Ticketmaster request failed with HTTP ${response.status}`);
      }

      const retryAfter = Number(response.headers.get('retry-after'));
      const delayMs = Number.isFinite(retryAfter)
        ? Math.max(retryAfter * 1000, REQUEST_INTERVAL_MS)
        : REQUEST_INTERVAL_MS * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error('Ticketmaster request failed after retries');
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextRequestAt - now);
    this.nextRequestAt = Math.max(now, this.nextRequestAt) + REQUEST_INTERVAL_MS;
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

export function createTicketmasterProvider(apiKey = serverEnv().TICKETMASTER_API_KEY): TicketmasterProvider {
  return new TicketmasterProvider(apiKey);
}
