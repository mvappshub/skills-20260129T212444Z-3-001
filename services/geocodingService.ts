import { isValidLngLat } from './geo'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

type SearchParams = {
  q?: string
  street?: string
  city?: string
}

type StructuredQuery = {
  street?: string
  city?: string
  hasHouseNumber: boolean
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function includesNormalized(query: string, value?: string): boolean {
  if (!value) return false
  return query.includes(normalize(value))
}

function scoreCandidate(query: string, candidate: Record<string, unknown>): number {
  const address = (candidate.address ?? {}) as Record<string, string>
  let score = 0

  if (includesNormalized(query, address.house_number)) score += 3

  const road = address.road ?? address.pedestrian ?? address.footway ?? address.path
  if (includesNormalized(query, road)) score += 2

  const locality =
    address.city ??
    address.town ??
    address.village ??
    address.suburb ??
    address.city_district ??
    address.municipality
  if (includesNormalized(query, locality)) score += 2

  if (includesNormalized(query, address.postcode)) score += 1

  return score
}

function pickBestCandidate(query: string, data: unknown[]): Record<string, unknown> | null {
  const candidates = data
    .filter(candidate => candidate && typeof candidate === 'object')
    .map(candidate => {
      const item = candidate as Record<string, unknown>
      const lat = Number(item.lat)
      const lng = Number(item.lon)
      if (!isValidLngLat(lat, lng)) return null
      return { item, score: scoreCandidate(query, item) }
    })
    .filter(Boolean) as Array<{ item: Record<string, unknown>; score: number }>

  if (candidates.length === 0) return null

  candidates.sort((a, b) => b.score - a.score)
  return candidates[0].item
}

function parseStructuredQuery(value: string): StructuredQuery {
  const tokens = value
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)

  const houseIndex = tokens.findIndex(token => /\d/.test(token))
  if (houseIndex === -1) {
    return { hasHouseNumber: false }
  }

  const street = tokens.slice(0, houseIndex + 1).join(' ')
  const city = tokens.slice(houseIndex + 1).join(' ')

  return {
    hasHouseNumber: true,
    street: street || undefined,
    city: city || undefined,
  }
}

function buildSearchUrl(params: SearchParams): URL {
  const url = new URL(NOMINATIM_SEARCH_URL)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '5')

  if (params.q) url.searchParams.set('q', params.q)
  if (params.street) url.searchParams.set('street', params.street)
  if (params.city) url.searchParams.set('city', params.city)

  return url
}

async function fetchCandidates(url: URL, signal?: AbortSignal): Promise<unknown[] | null> {
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) return null

  const data = await response.json()
  if (!Array.isArray(data)) return null

  return data
}

function hasHouseNumberCandidate(data: unknown[]): boolean {
  return data.some(candidate => {
    if (!candidate || typeof candidate !== 'object') return false
    const address = (candidate as Record<string, unknown>).address as
      | Record<string, unknown>
      | undefined
    const houseNumber = address?.house_number
    return typeof houseNumber === 'string' && houseNumber.trim().length > 0
  })
}

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

export async function forwardGeocode(
  address: string,
  signal?: AbortSignal
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim()
  if (!trimmed) return null

  const structured = parseStructuredQuery(trimmed)
  const query = normalize(trimmed)

  const initialData = await fetchCandidates(buildSearchUrl({ q: trimmed }), signal)
  if (!initialData || initialData.length === 0) return null

  let data = initialData

  if (structured.hasHouseNumber && !hasHouseNumberCandidate(initialData) && structured.street) {
    const structuredData = await fetchCandidates(
      buildSearchUrl({ street: structured.street, city: structured.city }),
      signal
    )

    if (structuredData && structuredData.length > 0) {
      data = structuredData
    }
  }

  const best = pickBestCandidate(query, data)
  if (!best) return null

  const lat = Number(best.lat)
  const lng = Number(best.lon)

  if (!isValidLngLat(lat, lng)) return null

  return { lat, lng }
}
