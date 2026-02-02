import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

import { EVENT_DATE_COLUMN, getDayRangeIso } from './notificationService';

describe('notificationService helpers', () => {
  it('uses start_at for event date filtering', () => {
    expect(EVENT_DATE_COLUMN).toBe('start_at');
  });

  it('builds a 24h range that contains the provided date', () => {
    const sample = new Date('2026-02-02T12:34:56Z');
    const { startAt, endAt } = getDayRangeIso(sample);
    const start = new Date(startAt);
    const end = new Date(endAt);

    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(sample >= start && sample < end).toBe(true);
  });
});
