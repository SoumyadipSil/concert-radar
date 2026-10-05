import { describe, it, expect } from 'vitest';
import {
  haversineDistanceKm,
  isWithinRadius,
  kmToMiles,
  milesToKm,
  getEffectiveRadiusKm,
} from '@/lib/geo';

describe('haversineDistanceKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineDistanceKm(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('calculates distance between New York and London (~5570 km)', () => {
    const distance = haversineDistanceKm(40.7128, -74.006, 51.5074, -0.1278);
    // Accepted range: 5560-5580 km
    expect(distance).toBeGreaterThan(5560);
    expect(distance).toBeLessThan(5580);
  });

  it('calculates distance between Kolkata and Delhi (~1305 km)', () => {
    const distance = haversineDistanceKm(22.5726, 88.3639, 28.6139, 77.209);
    expect(distance).toBeGreaterThan(1290);
    expect(distance).toBeLessThan(1320);
  });

  it('calculates a short distance between two nearby points', () => {
    // Two points about 1 km apart in central London
    const distance = haversineDistanceKm(51.5074, -0.1278, 51.5164, -0.1278);
    expect(distance).toBeGreaterThan(0.9);
    expect(distance).toBeLessThan(1.1);
  });

  it('handles antipodal points (~20,000 km)', () => {
    const distance = haversineDistanceKm(0, 0, 0, 180);
    expect(distance).toBeGreaterThan(20000);
    expect(distance).toBeLessThan(20100);
  });
});

describe('isWithinRadius', () => {
  it('returns true when distance is within radius', () => {
    // London to a nearby venue (~5 km)
    expect(isWithinRadius(51.5074, -0.1278, 51.5355, -0.0836, 10)).toBe(true);
  });

  it('returns false when distance exceeds radius', () => {
    // New York to London (~5570 km), radius 100 km
    expect(isWithinRadius(40.7128, -74.006, 51.5074, -0.1278, 100)).toBe(false);
  });

  it('returns true when distance exactly equals radius (edge case)', () => {
    const distance = haversineDistanceKm(22.5726, 88.3639, 28.6139, 77.209);
    // Use the exact distance as radius
    expect(isWithinRadius(22.5726, 88.3639, 28.6139, 77.209, distance)).toBe(true);
  });
});

describe('kmToMiles / milesToKm', () => {
  it('converts km to miles', () => {
    expect(kmToMiles(1.60934)).toBeCloseTo(1, 4);
  });

  it('converts miles to km', () => {
    expect(milesToKm(1)).toBeCloseTo(1.60934, 4);
  });

  it('round-trips correctly', () => {
    const km = 100;
    expect(milesToKm(kmToMiles(km))).toBeCloseTo(km, 10);
  });
});

describe('getEffectiveRadiusKm', () => {
  it('returns km as-is when unit is km', () => {
    expect(getEffectiveRadiusKm(100, 'km')).toBe(100);
  });

  it('converts miles to km when unit is mi', () => {
    expect(getEffectiveRadiusKm(100, 'mi')).toBeCloseTo(160.934, 2);
  });
});
