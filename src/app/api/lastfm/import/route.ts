import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fetchLastFmTopArtists } from '@/lib/lastfm';
import { normalizeArtistName } from '@/lib/normalize';

const importSchema = z.object({
  username: z.string().min(1),
  period: z.enum(['overall', '12month', '6month']).default('overall'),
});

export async function POST(request: Request) {
  try {
    const body = importSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const artists = await fetchLastFmTopArtists(body.username, body.period);

    for (const artist of artists) {
      const artistTable = supabase.from('artists') as any;
      const { data: artistRow, error: artistError } = await artistTable
        .upsert(
          {
            name: artist.name,
            normalized_name: artist.normalizedName,
            mbid: artist.mbid,
          },
          { onConflict: 'mbid' }
        )
        .select('id')
        .single();

      let resolvedArtistId: string | null = artistRow?.id ?? null;

      if (artistError || !resolvedArtistId) {
        const { data: existing } = await (supabase.from('artists') as any)
          .select('id')
          .eq('normalized_name', normalizeArtistName(artist.name))
          .maybeSingle();

        if (!existing?.id) {
          throw new Error(`Unable to upsert artist: ${artist.name}`);
        }

        resolvedArtistId = existing.id;
      }

      await (supabase.from('followed_artists') as any).upsert(
        {
          user_id: userData.user.id,
          artist_id: resolvedArtistId,
          source: 'lastfm',
          playcount: artist.playcount,
        },
        { onConflict: 'user_id,artist_id' }
      );
    }

    await (supabase.from('profiles') as any).upsert(
      {
        id: userData.user.id,
        lastfm_username: body.username,
      },
      { onConflict: 'id' }
    );

    return NextResponse.json({ imported: artists.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import Last.fm artists';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
