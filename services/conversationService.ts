// services/conversationService.ts
/**
 * Conversation and Message persistence service
 * Enables chat history and agent action logging
 */

import { supabase } from '../lib/supabase';

// ============================================================================
// Types
// ============================================================================

export interface Conversation {
    id: string;
    title: string | null;
    started_at: string;
    last_message_at: string;
    message_count: number;
    created_at: string;
}

export interface StoredMessage {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_calls?: any;
    tool_call_id?: string;
    created_at: string;
}

export interface AgentAction {
    id: string;
    conversation_id: string | null;
    action_type: string;
    action_data: any;
    result: any;
    success: boolean;
    created_at: string;
}

// ============================================================================
// Conversation CRUD
// ============================================================================

/**
 * Create a new conversation
 */
export async function createConversation(title?: string): Promise<Conversation> {
    const { data, error } = await supabase
        .from('conversations')
        .insert({ title: title || null })
        .select()
        .single();

    if (error) {
        console.error('[ConversationService] Error creating conversation:', error);
        throw error;
    }

    return data;
}

/**
 * Get all conversations ordered by last activity
 */
export async function getConversations(limit = 50): Promise<Conversation[]> {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[ConversationService] Error fetching conversations:', error);
        throw error;
    }

    return data || [];
}

/**
 * Get a single conversation by ID
 */
export async function getConversation(id: string): Promise<Conversation | null> {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error('[ConversationService] Error fetching conversation:', error);
        throw error;
    }

    return data;
}

/**
 * Update conversation title (auto-generated from first message)
 */
export async function updateConversationTitle(
    conversationId: string,
    title: string
): Promise<void> {
    const { error } = await supabase
        .from('conversations')
        .update({ title })
        .eq('id', conversationId);

    if (error) {
        console.error('[ConversationService] Error updating title:', error);
    }
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(id: string): Promise<void> {
    const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[ConversationService] Error deleting conversation:', error);
        throw error;
    }
}

// ============================================================================
// Message CRUD
// ============================================================================

/**
 * Save a message to a conversation
 */
export async function saveMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    toolCalls?: any,
    toolCallId?: string
): Promise<StoredMessage> {
    const { data, error } = await supabase
        .from('messages')
        .insert({
            conversation_id: conversationId,
            role,
            content,
            tool_calls: toolCalls || null,
            tool_call_id: toolCallId || null
        })
        .select()
        .single();

    if (error) {
        console.error('[ConversationService] Error saving message:', error);
        throw error;
    }

    // Update conversation stats
    await supabase
        .from('conversations')
        .update({
            last_message_at: new Date().toISOString(),
            message_count: supabase.rpc('increment_message_count', { conv_id: conversationId })
        })
        .eq('id', conversationId);

    return data;
}

/**
 * Get all messages for a conversation
 */
export async function getMessages(conversationId: string): Promise<StoredMessage[]> {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[ConversationService] Error fetching messages:', error);
        throw error;
    }

    return data || [];
}

// ============================================================================
// Agent Action Logging
// ============================================================================

/**
 * Log an agent action (tool call, creation, etc.)
 */
export async function logAgentAction(
    actionType: string,
    actionData: any,
    result: any,
    success = true,
    conversationId?: string
): Promise<AgentAction> {
    const { data, error } = await supabase
        .from('agent_actions')
        .insert({
            conversation_id: conversationId || null,
            action_type: actionType,
            action_data: actionData,
            result,
            success
        })
        .select()
        .single();

    if (error) {
        console.error('[ConversationService] Error logging action:', error);
        throw error;
    }

    return data;
}

/**
 * Get recent agent actions
 */
export async function getAgentActions(limit = 50): Promise<AgentAction[]> {
    const { data, error } = await supabase
        .from('agent_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[ConversationService] Error fetching actions:', error);
        throw error;
    }

    return data || [];
}

/**
 * Get actions for a specific conversation
 */
export async function getConversationActions(
    conversationId: string
): Promise<AgentAction[]> {
    const { data, error } = await supabase
        .from('agent_actions')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[ConversationService] Error fetching conversation actions:', error);
        throw error;
    }

    return data || [];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a title from the first user message
 */
export function generateTitleFromMessage(content: string): string {
    // Take first 50 chars and cut at word boundary
    const maxLength = 50;
    if (content.length <= maxLength) return content;

    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    return lastSpace > 20
        ? truncated.substring(0, lastSpace) + '...'
        : truncated + '...';
}
