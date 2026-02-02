export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function isValidLngLat(lat: number, lng: number): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

export function assertValidLngLat(lat: number, lng: number, label = 'location'): void {
  if (!isValidLngLat(lat, lng)) {
    throw new Error(`Invalid ${label} coordinates`);
  }
}

export function filterValidMapPoints<T extends { lat: number; lng: number }>(items: T[]): T[] {
  return items.filter(item => isValidLngLat(item.lat, item.lng));
}
