import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { geocodeLocation } from '@/lib/geocode';

const geocodeSchema = z.object({
  city: z.string().min(1),
  country_code: z.string().length(2).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = geocodeSchema.parse(await request.json());
    const result = await geocodeLocation(body.city, body.country_code);

    if (!result) {
      return NextResponse.json(
        { error: `Could not geocode "${body.city}"` },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Geocoding failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
