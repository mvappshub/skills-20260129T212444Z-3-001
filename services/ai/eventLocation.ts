import { forwardGeocode } from '../geocodingService'

type LocationArgs = {
  lat?: number
  lng?: number
  address?: string
}

export async function resolveEventLocation(args: LocationArgs): Promise<{ lat: number; lng: number } | null> {
  if (Number.isFinite(args.lat) && Number.isFinite(args.lng)) {
    return { lat: args.lat as number, lng: args.lng as number }
  }

  if (args.address) {
    return await forwardGeocode(args.address)
  }

  return null
}
