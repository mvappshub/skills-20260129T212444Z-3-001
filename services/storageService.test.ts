import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const upload = vi.fn();
  const remove = vi.fn();
  const getPublicUrl = vi.fn();
  const storageFrom = vi.fn(() => ({
    upload,
    remove,
    getPublicUrl
  }));

  const insert = vi.fn();
  const from = vi.fn((table: string) => {
    if (table === 'tree_photos') {
      return { insert };
    }
    return {};
  });

  return {
    upload,
    remove,
    getPublicUrl,
    storageFrom,
    insert,
    from
  };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: mocks.storageFrom
    },
    from: mocks.from
  }
}));

import { uploadAndSavePhoto } from './storageService';

describe('storageService uploadAndSavePhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    mocks.upload.mockResolvedValue({ error: null });
    mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/photo.jpg' } });
  });

  it('removes uploaded file if DB insert fails', async () => {
    mocks.insert.mockResolvedValueOnce({ error: new Error('db failed') });
    mocks.remove.mockResolvedValueOnce({ error: null });

    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
    await expect(uploadAndSavePhoto(file, 'tree-1')).rejects.toThrow('db failed');

    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });
});
