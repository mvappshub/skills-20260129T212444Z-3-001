import { describe, it, expect } from 'vitest';
import { resolveEventLocation } from './eventLocation';

describe('resolveEventLocation', () => {
  it('returns null when lat/lng missing', async () => {
    expect(await resolveEventLocation({})).toBeNull();
    expect(await resolveEventLocation({ lat: 50 })).toBeNull();
    expect(await resolveEventLocation({ lng: 14 })).toBeNull();
  });

  it('returns location when lat/lng are finite', async () => {
    const result = await resolveEventLocation({ lat: 50.1, lng: 14.4 });
    expect(result).toEqual({ lat: 50.1, lng: 14.4 });
  });
});
