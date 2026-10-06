import { describe, expect, it, vi } from 'vitest';
import coldplayAttractions from './fixtures/ticketmaster/attractions-coldplay.json';
import noMatchAttractions from './fixtures/ticketmaster/attractions-no-match.json';
import normalEvents from './fixtures/ticketmaster/events-normal.json';
import presaleEvents from './fixtures/ticketmaster/events-presales.json';
import cancelledEvents from './fixtures/ticketmaster/events-cancelled.json';
import { TicketmasterProvider } from '@/lib/providers/ticketmaster';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('TicketmasterProvider', () => {
  it('resolves only an exact normalized artist match', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(coldplayAttractions));
    const provider = new TicketmasterProvider('test-key', fetchMock);

    await expect(provider.resolveArtist('COLDPLAY')).resolves.toBe('K8vZ917GihV');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain('classificationName=music');
  });

  it('returns null when no exact artist match exists', async () => {
    const provider = new TicketmasterProvider(
      'test-key',
      vi.fn().mockResolvedValue(response(noMatchAttractions))
    );

    await expect(provider.resolveArtist('Coldplay')).resolves.toBeNull();
  });

  it('normalizes event and venue fields to the canonical shape', async () => {
    const provider = new TicketmasterProvider(
      'test-key',
      vi.fn().mockResolvedValue(response(normalEvents))
    );

    const [event] = await provider.fetchEventsForArtist('K8vZ917GihV');
    expect(event).toMatchObject({
      provider: 'ticketmaster',
      externalId: 'G5vZ9abc123',
      artistName: 'Coldplay',
      venueName: 'Netaji Indoor Stadium',
      city: 'Kolkata',
      countryCode: 'IN',
      lat: 22.5646,
      lng: 88.3426,
      startsAt: '2027-02-14T13:30:00.000Z',
      timezone: 'Asia/Kolkata',
      onsaleAt: '2026-10-10T05:30:00.000Z',
      status: 'scheduled',
    });
  });

  it('normalizes presales and tolerates a missing venue', async () => {
    const provider = new TicketmasterProvider(
      'test-key',
      vi.fn().mockResolvedValue(response(presaleEvents))
    );

    const [event] = await provider.fetchEventsForArtist('K8vZ917GihV');
    expect(event.venueName).toBeNull();
    expect(event.presales).toEqual([
      {
        name: 'Fan Club',
        startsAt: '2026-10-08T10:00:00.000Z',
        endsAt: '2026-10-09T10:00:00.000Z',
      },
    ]);
  });

  it('maps cancelled events without dropping them', async () => {
    const provider = new TicketmasterProvider(
      'test-key',
      vi.fn().mockResolvedValue(response(cancelledEvents))
    );

    const [event] = await provider.fetchEventsForArtist('K8vZ917GihV');
    expect(event.status).toBe('cancelled');
    expect(event.startsAt).toBeNull();
  });

  it('retries HTTP 429 responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({}, 429))
      .mockResolvedValueOnce(response(normalEvents));
    const provider = new TicketmasterProvider('test-key', fetchMock);

    await expect(provider.fetchEventsForArtist('K8vZ917GihV')).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
