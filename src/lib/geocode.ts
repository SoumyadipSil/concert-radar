import { z } from 'zod';

const geocodeResultSchema = z.object({
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  timezone: z.string().optional(),
  name: z.string().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
});

const geocodeResponseSchema = z.object({
  results: z.array(geocodeResultSchema).optional().default([]),
});

export interface GeocodeResult {
  lat: number;
  lng: number;
  timezone: string | null;
  city: string | null;
  countryCode: string | null;
}

/**
 * Geocode a city name using Open-Meteo's free geocoding API.
 * Filters by country code to disambiguate (e.g. "Birmingham, GB" vs "Birmingham, US").
 */
export async function geocodeLocation(
  city: string,
  countryCode?: string
): Promise<GeocodeResult | null> {
  const trimmedCity = city.trim();
  if (!trimmedCity) return null;

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', trimmedCity);
  url.searchParams.set('count', '10');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await fetch(url);
  if (!response.ok) return null;

  const payload = await response.json();
  const parsed = geocodeResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.results.length === 0) return null;

  // If a country code is provided, prefer a result matching that country
  const upperCountry = countryCode?.toUpperCase();
  const match = upperCountry
    ? parsed.data.results.find(
        (r) => r.country_code?.toUpperCase() === upperCountry
      ) ?? parsed.data.results[0]
    : parsed.data.results[0];

  return {
    lat: match.latitude,
    lng: match.longitude,
    timezone: match.timezone ?? null,
    city: match.name ?? trimmedCity,
    countryCode: match.country_code?.toUpperCase() ?? upperCountry ?? null,
  };
}
