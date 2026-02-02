import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const insert = vi.fn();
  const from = vi.fn((table: string) => {
    if (table === 'trees') return { insert };
    return {};
  });
  return { insert, from };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mocks.from
  }
}));

import { createTree } from './treeService';

describe('treeService createTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: 'tree-1' }, error: null })
      })
    });
  });

  it('rejects invalid coordinates before insert', async () => {
    await expect(createTree({
      species_name_latin: 'Quercus robur',
      planted_at: new Date('2026-02-02T10:00:00Z'),
      lat: 50,
      lng: 999,
      notes: 'bad'
    })).rejects.toThrow('Invalid');

    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
