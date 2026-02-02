import { describe, it, expect } from 'vitest';
import { buildPlanEvent } from './planEvent';
import { EventType } from '../types';

describe('buildPlanEvent', () => {
  it('throws when location is missing', () => {
    expect(() => buildPlanEvent({
      title: 'Test',
      type: EventType.PLANTING,
      date: '2026-02-02',
      pickedLocation: null
    })).toThrow('Missing location');
  });

  it('builds event with picked location', () => {
    const result = buildPlanEvent({
      title: 'Test',
      type: EventType.OTHER,
      date: '2026-02-02',
      pickedLocation: { lat: 50.1, lng: 14.4 },
      address: 'Somewhere'
    });

    expect(result.lat).toBe(50.1);
    expect(result.lng).toBe(14.4);
    expect(result.address).toBe('Somewhere');
  });
});
