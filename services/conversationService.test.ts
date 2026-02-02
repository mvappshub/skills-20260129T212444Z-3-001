import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const deleteMessagesEq = vi.fn();
  const deleteMessages = vi.fn(() => ({ eq: deleteMessagesEq }));
  const deleteActionsEq = vi.fn();
  const deleteActions = vi.fn(() => ({ eq: deleteActionsEq }));
  const deleteConversationsEq = vi.fn();
  const deleteConversations = vi.fn(() => ({ eq: deleteConversationsEq }));

  const from = vi.fn((table: string) => {
    if (table === 'messages') return { delete: deleteMessages };
    if (table === 'agent_actions') return { delete: deleteActions };
    if (table === 'conversations') return { delete: deleteConversations };
    return {};
  });

  return {
    from,
    deleteMessages,
    deleteMessagesEq,
    deleteActions,
    deleteActionsEq,
    deleteConversations,
    deleteConversationsEq
  };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mocks.from
  }
}));

import { deleteConversation } from './conversationService';

describe('conversationService deleteConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteMessagesEq.mockResolvedValue({ error: null });
    mocks.deleteActionsEq.mockResolvedValue({ error: null });
    mocks.deleteConversationsEq.mockResolvedValue({ error: null });
  });

  it('deletes related messages and agent actions before conversation', async () => {
    await deleteConversation('conv-1');

    expect(mocks.deleteMessages).toHaveBeenCalledTimes(1);
    expect(mocks.deleteMessagesEq).toHaveBeenCalledWith('conversation_id', 'conv-1');
    expect(mocks.deleteActions).toHaveBeenCalledTimes(1);
    expect(mocks.deleteActionsEq).toHaveBeenCalledWith('conversation_id', 'conv-1');
    expect(mocks.deleteConversations).toHaveBeenCalledTimes(1);
    expect(mocks.deleteConversationsEq).toHaveBeenCalledWith('id', 'conv-1');
  });

  it('throws when conversation delete fails', async () => {
    mocks.deleteConversationsEq.mockResolvedValueOnce({ error: new Error('delete failed') });

    await expect(deleteConversation('conv-2')).rejects.toThrow('delete failed');
  });
});
