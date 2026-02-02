import { describe, it, expect } from 'vitest';
import {
  isValidLatitude,
  isValidLongitude,
  isValidLngLat,
  filterValidMapPoints
} from './geo';

describe('geo utils', () => {
  it('validates latitude and longitude ranges', () => {
    expect(isValidLatitude(50)).toBe(true);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLongitude(14)).toBe(true);
    expect(isValidLongitude(-181)).toBe(false);
  });

  it('validates lat/lng pairs', () => {
    expect(isValidLngLat(50, 14)).toBe(true);
    expect(isValidLngLat(120, 14)).toBe(false);
  });

  it('filters invalid map points', () => {
    const items = [
      { id: 'a', lat: 50, lng: 14 },
      { id: 'b', lat: 999, lng: 14 }
    ];

    const result = filterValidMapPoints(items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });
});
