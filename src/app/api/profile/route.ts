import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { geocodeLocation } from '@/lib/geocode';

const profileSchema = z.object({
  country_code: z.string().length(2).optional(),
  city: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radius_km: z.number().int().min(1).max(5000).optional(),
  distance_unit: z.enum(['km', 'mi']).optional(),
  timezone: z.string().optional(),
  notify_telegram: z.boolean().optional(),
  notify_email: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    const body = profileSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profileUpdate: Record<string, unknown> = { id: user.id };

    if (body.country_code !== undefined) profileUpdate.country_code = body.country_code.toUpperCase();
    if (body.radius_km !== undefined) profileUpdate.radius_km = body.radius_km;
    if (body.distance_unit !== undefined) profileUpdate.distance_unit = body.distance_unit;
    if (body.timezone !== undefined) profileUpdate.timezone = body.timezone;
    if (body.notify_telegram !== undefined) profileUpdate.notify_telegram = body.notify_telegram;
    if (body.notify_email !== undefined) profileUpdate.notify_email = body.notify_email;

    // Geocode city if provided, using country_code for disambiguation
    if (body.city !== undefined && body.city.trim()) {
      profileUpdate.city = body.city;
      const geocoded = await geocodeLocation(body.city, body.country_code);
      if (geocoded) {
        profileUpdate.lat = geocoded.lat;
        profileUpdate.lng = geocoded.lng;
        if (!body.timezone) profileUpdate.timezone = geocoded.timezone ?? 'UTC';
        if (!body.country_code) profileUpdate.country_code = geocoded.countryCode;
      }
    } else if (body.city !== undefined) {
      profileUpdate.city = body.city;
    }

    // Allow manual lat/lng override
    if (body.latitude !== undefined) profileUpdate.lat = body.latitude;
    if (body.longitude !== undefined) profileUpdate.lng = body.longitude;

    const { error } = await supabase.from('profiles').upsert(profileUpdate, { onConflict: 'id' });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update profile';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
