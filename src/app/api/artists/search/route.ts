import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { normalizeArtistName } from '@/lib/normalize';
import { serverEnv } from '@/lib/env';

const searchSchema = z.object({
  q: z.string().min(1).max(200),
});

interface ArtistSearchResult {
  id: string | null; // null if from Last.fm and not yet in our DB
  name: string;
  mbid: string | null;
  source: 'local' | 'lastfm';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get('q') ?? '';
    const parsed = searchSchema.safeParse({ q: query });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const results: ArtistSearchResult[] = [];

    // Search local DB first (ilike on name for partial matches)
    const { data: localArtists } = await supabase
      .from('artists')
      .select('id, name, mbid')
      .ilike('name', `%${parsed.data.q}%`)
      .limit(10);

    for (const a of localArtists ?? []) {
      results.push({ id: a.id, name: a.name, mbid: a.mbid, source: 'local' });
    }

    // If fewer than 5 local results, supplement with Last.fm artist.search
    if (results.length < 5) {
      try {
        const env = serverEnv();
        const url = new URL('https://ws.audioscrobbler.com/2.0/');
        url.searchParams.set('method', 'artist.search');
        url.searchParams.set('artist', parsed.data.q);
        url.searchParams.set('limit', '10');
        url.searchParams.set('api_key', env.LASTFM_API_KEY);
        url.searchParams.set('format', 'json');

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const matches = data?.results?.artistmatches?.artist ?? [];
          const seenNames = new Set(results.map((r) => normalizeArtistName(r.name)));

          for (const match of matches) {
            if (!match.name || seenNames.has(normalizeArtistName(match.name))) continue;
            seenNames.add(normalizeArtistName(match.name));
            results.push({
              id: null,
              name: match.name,
              mbid: match.mbid?.trim() || null,
              source: 'lastfm',
            });
            if (results.length >= 15) break;
          }
        }
      } catch {
        // Last.fm search is best-effort; local results are still returned
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
