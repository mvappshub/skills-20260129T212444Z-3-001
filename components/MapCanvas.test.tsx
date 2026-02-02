import { describe, it, expect } from 'vitest';
import { filterValidMapPoints } from './MapCanvas';
import { EventStatus, EventType } from '../types';

describe('MapCanvas helpers', () => {
  it('filters out invalid lat/lng points', () => {
    const events = [
      {
        id: 'e1',
        type: EventType.PLANTING,
        status: EventStatus.PLANNED,
        title: 'Valid',
        start_at: new Date(),
        lat: 50.0755,
        lng: 14.4378,
        items: []
      },
      {
        id: 'e2',
        type: EventType.PLANTING,
        status: EventStatus.PLANNED,
        title: 'Invalid',
        start_at: new Date(),
        lat: 999,
        lng: 14,
        items: []
      }
    ];

    const trees = [
      {
        id: 't1',
        species_name_latin: 'Quercus robur',
        planted_at: new Date(),
        lat: 48,
        lng: 17,
        photos: []
      },
      {
        id: 't2',
        species_name_latin: 'Quercus robur',
        planted_at: new Date(),
        lat: 49,
        lng: NaN,
        photos: []
      }
    ];

    const result = filterValidMapPoints(events, trees);

    expect(result.events).toHaveLength(1);
    expect(result.trees).toHaveLength(1);
    expect(result.events[0].id).toBe('e1');
    expect(result.trees[0].id).toBe('t1');
  });
});
