// services/cacheService.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const CACHE_PREFIX = 'silvaplan_';

export function setCache<T>(key: string, data: T, ttlMinutes: number): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  };

  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (error) {
    console.warn('Failed to cache data:', error);
  }
}

export function getCache<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(CACHE_PREFIX + key);
    if (!stored) return null;

    const entry: CacheEntry<T> = JSON.parse(stored);

    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn('Failed to read cache:', error);
    return null;
  }
}

export function clearCache(keyPattern?: string): void {
  const keys = Object.keys(localStorage).filter(k =>
    k.startsWith(CACHE_PREFIX) &&
    (!keyPattern || k.includes(keyPattern))
  );

  keys.forEach(k => localStorage.removeItem(k));
}
