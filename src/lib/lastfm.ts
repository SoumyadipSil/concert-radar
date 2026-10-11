import { z } from 'zod';
import { normalizeArtistName } from './normalize';
import { serverEnv } from './env';

const lastFmArtistSchema = z.object({
  name: z.string(),
  mbid: z.string().optional().default(''),
  playcount: z.coerce.number().default(0),
});

const lastFmResponseSchema = z.object({
  error: z.union([z.string(), z.number()]).optional(),
  topartists: z
    .object({
      artist: z.array(lastFmArtistSchema).default([]),
    })
    .optional(),
});

export interface LastFmArtist {
  name: string;
  mbid: string | null;
  playcount: number;
  normalizedName: string;
}

export function dedupeArtistImports(artists: LastFmArtist[]): LastFmArtist[] {
  const seen = new Map<string, LastFmArtist>();

  for (const artist of artists) {
    const key = artist.mbid || artist.normalizedName;
    if (!seen.has(key)) {
      seen.set(key, artist);
    }
  }

  return Array.from(seen.values());
}

export async function fetchLastFmTopArtists(
  username: string,
  period: 'overall' | '12month' | '6month' = 'overall',
  apiKey = serverEnv().LASTFM_API_KEY
): Promise<LastFmArtist[]> {
  const trimmed = username.trim();
  if (!trimmed) {
    throw new Error('Last.fm username is required');
  }

  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.searchParams.set('method', 'user.gettopartists');
  url.searchParams.set('user', trimmed);
  url.searchParams.set('period', period);
  url.searchParams.set('limit', '50');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Last.fm request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const parsed = lastFmResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Invalid Last.fm response format');
  }

  if (typeof parsed.data.error !== 'undefined') {
    throw new Error('Last.fm user not found or the profile is private');
  }

  const results = parsed.data.topartists?.artist ?? [];
  return dedupeArtistImports(
    results
      .filter((artist) => artist.name && artist.name.trim())
      .map((artist) => ({
        name: artist.name.trim(),
        mbid: artist.mbid?.trim() || null,
        playcount: Number(artist.playcount) || 0,
        normalizedName: normalizeArtistName(artist.name),
      }))
  );
}
