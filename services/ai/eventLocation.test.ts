import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveEventLocation } from './eventLocation';

const mockFetch = (data: any, ok = true) => {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => data
  }) as unknown as typeof fetch;
};

describe('resolveEventLocation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns coords when lat/lng provided', async () => {
    const result = await resolveEventLocation({ lat: 50.1, lng: 14.4 });
    expect(result).toEqual({ lat: 50.1, lng: 14.4 });
  });

  it('geocodes address when lat/lng missing', async () => {
    vi.stubGlobal('fetch', mockFetch([{ lat: '49.1951', lon: '16.6068' }]));
    const result = await resolveEventLocation({ address: 'Brno' });
    expect(result).toEqual({ lat: 49.1951, lng: 16.6068 });
  });

  it('returns null when no location data', async () => {
    const result = await resolveEventLocation({});
    expect(result).toBeNull();
  });
});
