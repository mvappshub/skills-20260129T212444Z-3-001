import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const eventsInsertMock = vi.fn();
  const itemsInsertMock = vi.fn();
  const eventsDeleteEqMock = vi.fn();
  const eventsDeleteMock = vi.fn();
  const fromMock = vi.fn((table: string) => {
    if (table === 'events') {
      return {
        insert: eventsInsertMock,
        delete: eventsDeleteMock
      };
    }
    if (table === 'event_items') {
      return {
        insert: itemsInsertMock
      };
    }
    return {};
  });

  return {
    eventsInsertMock,
    itemsInsertMock,
    eventsDeleteEqMock,
    eventsDeleteMock,
    fromMock
  };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mocks.fromMock
  }
}));

import { createEvent, buildEventUpdatePayload } from './eventService';
import { EventStatus, EventType } from '../types';

describe('eventService helpers', () => {
  it('includes explicit empty fields and null end_at in update payload', () => {
    const payload = buildEventUpdatePayload({
      title: '',
      end_at: null,
      address: '',
      notes: ''
    });

    expect(Object.prototype.hasOwnProperty.call(payload, 'title')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(payload, 'end_at')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(payload, 'address')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(payload, 'notes')).toBe(true);
    expect(payload.title).toBe('');
    expect(payload.end_at).toBeNull();
  });
});

describe('eventService createEvent rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.eventsInsertMock.mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: 'ev1' }, error: null })
      })
    });

    mocks.itemsInsertMock.mockResolvedValue({ error: new Error('items failed') });

    mocks.eventsDeleteEqMock.mockResolvedValue({ error: null });
    mocks.eventsDeleteMock.mockReturnValue({
      eq: mocks.eventsDeleteEqMock
    });
  });

  it('deletes created event when item insert fails', async () => {
    await expect(createEvent({
      title: 'Test',
      type: EventType.OTHER,
      status: EventStatus.PLANNED,
      start_at: new Date('2026-02-02T10:00:00Z'),
      lat: 50,
      lng: 14,
      items: [{
        id: 'item-1',
        species_name_latin: 'Quercus robur',
        quantity: 1,
        size_class: '100-120'
      }]
    })).rejects.toThrow('items failed');

    expect(mocks.eventsDeleteMock).toHaveBeenCalledTimes(1);
    expect(mocks.eventsDeleteEqMock).toHaveBeenCalledWith('id', 'ev1');
  });

  it('rejects invalid coordinates before insert', async () => {
    await expect(createEvent({
      title: 'Bad coords',
      type: EventType.OTHER,
      status: EventStatus.PLANNED,
      start_at: new Date('2026-02-02T10:00:00Z'),
      lat: 999,
      lng: 14,
      items: []
    })).rejects.toThrow('Invalid');

    expect(mocks.eventsInsertMock).not.toHaveBeenCalled();
  });
});
