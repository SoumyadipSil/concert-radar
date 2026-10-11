import { z } from 'zod';

const geocodeResultSchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  timezone: z.string().optional(),
  name: z.string().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
});

const geocodeResponseSchema = z.array(geocodeResultSchema);

export interface GeocodeResult {
  lat: number;
  lng: number;
  timezone: string | null;
  city: string | null;
  countryCode: string | null;
}

export async function geocodeLocation(
  city: string,
  country?: string
): Promise<GeocodeResult | null> {
  const query = [city, country].filter(Boolean).join(', ');
  if (!query.trim()) {
    return null;
  }

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const parsed = geocodeResponseSchema.safeParse(payload.results ?? []);
  if (!parsed.success || parsed.data.length === 0) {
    return null;
  }

  const match = parsed.data[0];
  return {
    lat: Number(match.lat),
    lng: Number(match.lon),
    timezone: match.timezone ?? null,
    city: match.name ?? city ?? null,
    countryCode: match.country_code ?? country?.toUpperCase() ?? null,
  };
}
