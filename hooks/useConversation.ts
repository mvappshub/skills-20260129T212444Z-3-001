// hooks/useConversation.ts
/**
 * React hook for managing conversation state and persistence
 */

import { useState, useCallback, useEffect } from 'react';
import {
    createConversation,
    getConversations,
    getMessages,
    saveMessage,
    updateConversationTitle,
    deleteConversation,
    logAgentAction,
    generateTitleFromMessage,
    type Conversation,
    type StoredMessage
} from '../services/conversationService';
import type { Message } from '../services/ai/chatService';

interface UseConversationReturn {
    // State
    conversations: Conversation[];
    currentConversationId: string | null;
    messages: Message[];
    isLoading: boolean;
    error: string | null;

    // Actions
    startNewConversation: () => Promise<void>;
    loadConversation: (id: string) => Promise<void>;
    addUserMessage: (content: string) => Promise<void>;
    addAssistantMessage: (content: string, toolCalls?: any) => Promise<void>;
    addToolMessage: (content: string, toolCallId: string) => Promise<void>;
    logAction: (type: string, data: any, result: any, success?: boolean) => Promise<void>;
    deleteCurrentConversation: () => Promise<void>;
    refreshConversations: () => Promise<void>;
}

export function useConversation(): UseConversationReturn {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load conversations on mount
    useEffect(() => {
        refreshConversations();
    }, []);

    const refreshConversations = useCallback(async () => {
        try {
            const convs = await getConversations();
            setConversations(convs);
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    }, []);

    const startNewConversation = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const conv = await createConversation();
            setCurrentConversationId(conv.id);
            setMessages([]);
            await refreshConversations();
        } catch (err) {
            setError('Nepodařilo se vytvořit konverzaci');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [refreshConversations]);

    const loadConversation = useCallback(async (id: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const storedMessages = await getMessages(id);
            const formattedMessages: Message[] = storedMessages.map(m => ({
                role: m.role,
                content: m.content,
                tool_calls: m.tool_calls,
                tool_call_id: m.tool_call_id
            }));

            setCurrentConversationId(id);
            setMessages(formattedMessages);
        } catch (err) {
            setError('Nepodařilo se načíst konverzaci');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addUserMessage = useCallback(async (content: string) => {
        if (!currentConversationId) {
            // Auto-create conversation if none exists
            const conv = await createConversation();
            setCurrentConversationId(conv.id);

            // Set title from first message
            const title = generateTitleFromMessage(content);
            await updateConversationTitle(conv.id, title);

            await saveMessage(conv.id, 'user', content);
        } else {
            await saveMessage(currentConversationId, 'user', content);

            // Update title if this is first message
            if (messages.length === 0) {
                const title = generateTitleFromMessage(content);
                await updateConversationTitle(currentConversationId, title);
            }
        }

        setMessages(prev => [...prev, { role: 'user', content }]);
        await refreshConversations();
    }, [currentConversationId, messages.length, refreshConversations]);

    const addAssistantMessage = useCallback(async (content: string, toolCalls?: any) => {
        if (!currentConversationId) return;

        await saveMessage(currentConversationId, 'assistant', content, toolCalls);
        setMessages(prev => [...prev, { role: 'assistant', content, tool_calls: toolCalls }]);
        await refreshConversations();
    }, [currentConversationId, refreshConversations]);

    const addToolMessage = useCallback(async (content: string, toolCallId: string) => {
        if (!currentConversationId) return;

        await saveMessage(currentConversationId, 'tool', content, undefined, toolCallId);
        setMessages(prev => [...prev, { role: 'tool', content, tool_call_id: toolCallId }]);
    }, [currentConversationId]);

    const logAction = useCallback(async (
        type: string,
        data: any,
        result: any,
        success = true
    ) => {
        try {
            await logAgentAction(type, data, result, success, currentConversationId || undefined);
        } catch (err) {
            console.error('Failed to log action:', err);
        }
    }, [currentConversationId]);

    const deleteCurrentConversation = useCallback(async () => {
        if (!currentConversationId) return;

        try {
            await deleteConversation(currentConversationId);
            setCurrentConversationId(null);
            setMessages([]);
            await refreshConversations();
        } catch (err) {
            setError('Nepodařilo se smazat konverzaci');
            console.error(err);
        }
    }, [currentConversationId, refreshConversations]);

    return {
        conversations,
        currentConversationId,
        messages,
        isLoading,
        error,
        startNewConversation,
        loadConversation,
        addUserMessage,
        addAssistantMessage,
        addToolMessage,
        logAction,
        deleteCurrentConversation,
        refreshConversations
    };
}
