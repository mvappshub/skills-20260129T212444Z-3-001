import { describe, expect, it, vi, afterEach } from 'vitest'

import { forwardGeocode } from './geocodingService'

describe('forwardGeocode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefers results that match house number and locality', async () => {
    const data = [
      {
        lat: '50.087',
        lon: '14.421',
        address: {
          house_number: '1',
          road: 'Namesti Republiky',
          city: 'Praha',
        },
      },
      {
        lat: '50.015',
        lon: '14.497',
        address: {
          house_number: '548/26',
          road: 'Volarska',
          suburb: 'Kunratice',
          city: 'Praha',
        },
      },
    ]

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => data,
    })

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const result = await forwardGeocode('Volarska 548/26 Praha 4 Kunratice')

    expect(result).toEqual({ lat: 50.015, lng: 14.497 })
  })

  it('retries with structured query when house number is missing', async () => {
    const first = [
      {
        lat: '50.087',
        lon: '14.421',
        address: {
          road: 'Volarska',
          city: 'Praha',
        },
      },
    ]
    const second = [
      {
        lat: '50.015',
        lon: '14.497',
        address: {
          house_number: '548/26',
          road: 'Volarska',
          suburb: 'Kunratice',
          city: 'Praha',
        },
      },
    ]

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => first })
      .mockResolvedValueOnce({ ok: true, json: async () => second })

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const result = await forwardGeocode('Volarska 548/26 Praha 4 Kunratice')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1]?.[0] ?? '')).toContain('street=')
    expect(result).toEqual({ lat: 50.015, lng: 14.497 })
  })
})
