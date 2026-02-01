const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'

export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<string | null> {
  const url = new URL(NOMINATIM_URL)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('addressdetails', '1')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) return null

  const data = await response.json()
  if (data && typeof data.display_name === 'string' && data.display_name.trim()) {
    return data.display_name.trim()
  }

  return null
}
