import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchLastFmTopArtists } from '@/lib/lastfm';

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

    const admin = createAdminClient();
    const artists = await fetchLastFmTopArtists(body.username, body.period);
    let imported = 0;

    for (const artist of artists) {
      // Resolve or create the artist using admin client (RLS blocks user writes to artists)
      let artistId: string | null = null;

      if (artist.mbid) {
        // Try finding by MBID first
        const { data: byMbid } = await admin
          .from('artists')
          .select('id')
          .eq('mbid', artist.mbid)
          .maybeSingle();
        artistId = byMbid?.id ?? null;
      }

      if (!artistId) {
        // Try finding by normalized name
        const { data: byName } = await admin
          .from('artists')
          .select('id')
          .eq('normalized_name', artist.normalizedName)
          .maybeSingle();
        artistId = byName?.id ?? null;
      }

      if (!artistId) {
        // Insert new artist
        const { data: inserted, error: insertErr } = await admin
          .from('artists')
          .insert({
            name: artist.name,
            normalized_name: artist.normalizedName,
            mbid: artist.mbid,
          })
          .select('id')
          .single();

        if (insertErr) {
          // Race condition: another request inserted it. Try lookup again.
          const { data: retry } = await admin
            .from('artists')
            .select('id')
            .eq('normalized_name', artist.normalizedName)
            .maybeSingle();
          artistId = retry?.id ?? null;
          if (!artistId) continue; // Skip if still can't resolve
        } else {
          artistId = inserted.id;
        }
      }

      // Upsert follow (user client is fine here — user owns their follows)
      await supabase.from('followed_artists').upsert(
        {
          user_id: userData.user.id,
          artist_id: artistId,
          source: 'lastfm' as const,
          playcount: artist.playcount,
        },
        { onConflict: 'user_id,artist_id' }
      );

      imported += 1;
    }

    // Save Last.fm username to profile
    await supabase.from('profiles').upsert(
      {
        id: userData.user.id,
        lastfm_username: body.username,
      },
      { onConflict: 'id' }
    );

    return NextResponse.json({ imported });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import Last.fm artists';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
