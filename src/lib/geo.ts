import { EARTH_RADIUS_KM, KM_PER_MILE } from './constants';

/**
 * Calculate the great-circle distance between two points using the haversine formula.
 * This implementation mirrors the Postgres `haversine_distance_km` function
 * so that dashboard queries and server-side filtering produce identical results.
 *
 * @returns Distance in kilometers
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.asin(Math.sqrt(a));

  return EARTH_RADIUS_KM * c;
}

/** Convert kilometers to miles. */
export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

/** Convert miles to kilometers. */
export function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

/**
 * Check if a point is within a given radius of another point.
 *
 * @param userLat  User's latitude
 * @param userLng  User's longitude
 * @param eventLat Event's latitude
 * @param eventLng Event's longitude
 * @param radiusKm Maximum distance in kilometers
 * @returns true if the event is within the radius
 */
export function isWithinRadius(
  userLat: number,
  userLng: number,
  eventLat: number,
  eventLng: number,
  radiusKm: number
): boolean {
  return haversineDistanceKm(userLat, userLng, eventLat, eventLng) <= radiusKm;
}

/**
 * Get the effective radius in km, converting from miles if the user prefers miles.
 */
export function getEffectiveRadiusKm(
  radius: number,
  unit: 'km' | 'mi'
): number {
  return unit === 'mi' ? milesToKm(radius) : radius;
}
