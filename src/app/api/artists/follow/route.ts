import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeArtistName } from '@/lib/normalize';

const followSchema = z.object({
  artist_id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  mbid: z.string().optional(),
}).refine((d) => d.artist_id || d.name, {
  message: 'Either artist_id or name is required',
});

const unfollowSchema = z.object({
  artist_id: z.string().uuid(),
});

/** Resolve or create an artist, returning their ID. */
async function resolveArtistId(
  artistId: string | undefined,
  name: string | undefined,
  mbid: string | undefined
): Promise<string | null> {
  const admin = createAdminClient();

  if (artistId) {
    const { data } = await admin.from('artists').select('id').eq('id', artistId).maybeSingle();
    return data?.id ?? null;
  }

  if (!name) return null;
  const normalized = normalizeArtistName(name);

  // Try MBID first
  if (mbid) {
    const { data } = await admin.from('artists').select('id').eq('mbid', mbid).maybeSingle();
    if (data?.id) return data.id;
  }

  // Try normalized name
  const { data: byName } = await admin
    .from('artists')
    .select('id')
    .eq('normalized_name', normalized)
    .maybeSingle();
  if (byName?.id) return byName.id;

  // Create new artist
  const { data: created, error } = await admin
    .from('artists')
    .insert({
      name: name.trim(),
      normalized_name: normalized,
      mbid: mbid?.trim() || null,
    })
    .select('id')
    .single();

  if (error) {
    // Race condition fallback
    const { data: retry } = await admin
      .from('artists')
      .select('id')
      .eq('normalized_name', normalized)
      .maybeSingle();
    return retry?.id ?? null;
  }

  return created.id;
}

export async function POST(request: Request) {
  try {
    const body = followSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const artistId = await resolveArtistId(body.artist_id, body.name, body.mbid);
    if (!artistId) {
      return NextResponse.json({ error: 'Could not resolve artist' }, { status: 404 });
    }

    const { error } = await supabase.from('followed_artists').upsert(
      {
        user_id: user.id,
        artist_id: artistId,
        source: 'manual' as const,
      },
      { onConflict: 'user_id,artist_id' }
    );

    if (error) throw error;
    return NextResponse.json({ ok: true, artist_id: artistId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to follow artist';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = unfollowSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('followed_artists')
      .delete()
      .eq('user_id', user.id)
      .eq('artist_id', body.artist_id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unfollow artist';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
