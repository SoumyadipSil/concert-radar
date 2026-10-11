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
});

export async function PUT(request: Request) {
  try {
    const body = profileSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profileUpdate: Record<string, unknown> = { id: userData.user.id };

    if (typeof body.country_code !== 'undefined') profileUpdate.country_code = body.country_code.toUpperCase();
    if (typeof body.city !== 'undefined') profileUpdate.city = body.city;
    if (typeof body.radius_km !== 'undefined') profileUpdate.radius_km = body.radius_km;
    if (typeof body.distance_unit !== 'undefined') profileUpdate.distance_unit = body.distance_unit;
    if (typeof body.timezone !== 'undefined') profileUpdate.timezone = body.timezone;

    if (typeof body.city !== 'undefined' && body.city.trim()) {
      const geocoded = await geocodeLocation(body.city, body.country_code);
      if (geocoded) {
        profileUpdate.lat = geocoded.lat;
        profileUpdate.lng = geocoded.lng;
        profileUpdate.timezone = profileUpdate.timezone ?? geocoded.timezone ?? 'UTC';
        profileUpdate.country_code = profileUpdate.country_code ?? geocoded.countryCode ?? null;
      }
    }

    if (typeof body.latitude !== 'undefined') profileUpdate.lat = body.latitude;
    if (typeof body.longitude !== 'undefined') profileUpdate.lng = body.longitude;

    const { error } = await (supabase.from('profiles') as any).upsert(profileUpdate, { onConflict: 'id' });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update profile';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
