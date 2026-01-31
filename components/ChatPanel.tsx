// components/ChatPanel.tsx
/**
 * Chat Panel for SilvaPlan AI Assistant
 *
 * Provides conversational interface for AI assistant with tool calling support.
 * API keys are managed via settings modal (localStorage).
 * Conversations are persisted to Supabase.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, AlertCircle, X, MessageSquare, Settings, History, Plus, Trash2 } from 'lucide-react';
import { chat, Message, ChatResponse, isAIConfigured } from '../services/ai/chatService';
import { ChatMessage } from './ChatMessage';
import { SettingsModal } from './SettingsModal';
import { useConversation } from '../hooks/useConversation';
import { logAgentAction } from '../services/conversationService';

interface ChatPanelProps {
  onEventCreated?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  onEventCreated,
  isOpen,
  onClose,
  onOpenSettings
}) => {
  // Conversation persistence hook
  const {
    conversations,
    currentConversationId,
    messages,
    startNewConversation,
    loadConversation,
    addUserMessage,
    addAssistantMessage,
    addToolMessage,
    logAction,
    deleteCurrentConversation,
    refreshConversations
  } = useConversation();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !showSettings) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, showSettings]);

  // Listen for settings changes
  useEffect(() => {
    const handleSettingsChange = () => {
      // Clear error when settings change
      setError(null);
    };

    window.addEventListener('aisettings-changed', handleSettingsChange);
    return () => window.removeEventListener('aisettings-changed', handleSettingsChange);
  }, []);

  const handleOpenSettings = () => {
    setShowSettings(true);
    onOpenSettings?.();
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Check if configured
    if (!isAIConfigured()) {
      setError(
        'AI asistent není nakonfigurován. Klikněte na ikonu nastavení (ozubené kolo) pro nastavení API klíče.'
      );
      return;
    }

    const userMessage: Message = { role: 'user', content: input.trim() };
    const userContent = input.trim();
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      // Save user message to DB
      await addUserMessage(userContent);

      const allMessages = [...messages, userMessage];
      let response: ChatResponse = await chat(allMessages);

      // Save assistant response to DB
      await addAssistantMessage(response.message.content, response.message.tool_calls);

      // If tools were called, continue the conversation
      if (response.toolResults && response.toolResults.length > 0) {
        // Check if event was created/modified
        const eventModified = response.toolResults.some(
          r => ['createEvent', 'editEvent', 'deleteEvent'].includes(r.name) && r.result?.success
        );
        if (eventModified && onEventCreated) {
          onEventCreated();
        }

        // Log tool actions
        for (const tr of response.toolResults) {
          await logAction(tr.name, tr.result, tr.result, tr.result?.success !== false);
        }

        // Add tool results as messages and get final response
        const toolMessages: Message[] = response.message.tool_calls!.map((tc, i) => {
          const msg: Message = {
            role: 'tool' as const,
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(response.toolResults![i].result)
          };
          // Save tool message to DB
          addToolMessage(msg.content, tc.id);
          return msg;
        });

        const finalResponse = await chat(
          [...allMessages, response.message, ...toolMessages]
        );

        // Save final assistant response to DB
        await addAssistantMessage(finalResponse.message.content, finalResponse.message.tool_calls);

        // Handle nested tool calls if any
        if (finalResponse.toolResults && finalResponse.toolResults.length > 0) {
          const nestedEventModified = finalResponse.toolResults.some(
            r => ['createEvent', 'editEvent', 'deleteEvent'].includes(r.name) && r.result?.success
          );
          if (nestedEventModified && onEventCreated) {
            onEventCreated();
          }
          // Log nested tool actions
          for (const tr of finalResponse.toolResults) {
            await logAction(tr.name, tr.result, tr.result, tr.result?.success !== false);
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Nastala neočekávaná chyba');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleClearChat = async () => {
    await deleteCurrentConversation();
    setError(null);
  };

  const handleNewChat = async () => {
    await startNewConversation();
    setShowHistory(false);
  };

  const handleLoadConversation = async (id: string) => {
    await loadConversation(id);
    setShowHistory(false);
  };

  if (!isOpen) return null;

  const configured = isAIConfigured();

  return (
    <>
      <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <span className="font-semibold">SilvaPlan AI</span>
            {!configured && (
              <span className="text-xs bg-amber-500 px-2 py-0.5 rounded-full">Není nastaveno</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleOpenSettings}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Nastavení AI"
            >
              <Settings className="w-4 h-4" />
            </button>
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-xs"
                title="Vymazat konverzaci"
              >
                Vymazat
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 mt-8">
              <Bot className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">Ahoj! Jsem SilvaPlan AI.</p>
              <p className="text-sm mt-1">
                Pomůžu ti s plánováním výsadby a péčí o stromy.
              </p>

              {!configured ? (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800 font-medium mb-3">
                    Nejdříve musíte nastavit API klíč
                  </p>
                  <button
                    onClick={handleOpenSettings}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Otevřít nastavení
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-2 text-sm text-left">
                  <p className="text-slate-400 text-center">Zkus napsat:</p>
                  <button
                    onClick={() => handleSuggestionClick('Naplánuj výsadbu 5 dubů na příští týden')}
                    className="block w-full text-left px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    "Naplánuj výsadbu 5 dubů na příští týden"
                  </button>
                  <button
                    onClick={() => handleSuggestionClick('Jaké je počasí na tento týden?')}
                    className="block w-full text-left px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    "Jaké je počasí na tento týden?"
                  </button>
                  <button
                    onClick={() => handleSuggestionClick('Jsou nějaká rizika pro mé plánované akce?')}
                    className="block w-full text-left px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    "Jsou nějaká rizika pro mé plánované akce?"
                  </button>
                  <button
                    onClick={() => handleSuggestionClick('Kdy je nejlepší vysadit lípu?')}
                    className="block w-full text-left px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    "Kdy je nejlepší vysadit lípu?"
                  </button>
                </div>
              )}
            </div>
          )}

          {messages
            .filter(m => m.role !== 'tool' && m.role !== 'system')
            .map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Přemýšlím...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Chyba</p>
                <p className="text-sm mt-1">{error}</p>
                {!configured && (
                  <button
                    onClick={handleOpenSettings}
                    className="mt-2 text-sm underline hover:no-underline"
                  >
                    Otevřít nastavení
                  </button>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={!configured ? "Nejprve nastavte API klíč..." : "Napiš zprávu..."}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
              disabled={isLoading || !configured}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || !configured}
              className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={handleCloseSettings} />
    </>
  );
};

// Floating button to open chat
export const ChatButton: React.FC<{ onClick: () => void; onOpenSettings?: () => void }> = ({
  onClick,
  onOpenSettings
}) => (
  <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-40">
    {/* Settings button (smaller) */}
    <button
      onClick={onOpenSettings}
      className="w-12 h-12 bg-slate-700 text-white rounded-full shadow-lg hover:bg-slate-800 transition-all hover:scale-105 flex items-center justify-center"
      title="Nastavení AI"
    >
      <Settings className="w-5 h-5" />
    </button>
    {/* Chat button */}
    <button
      onClick={onClick}
      className="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-all hover:scale-105 flex items-center justify-center"
      title="Otevřít AI asistenta"
    >
      <MessageSquare className="w-6 h-6" />
    </button>
  </div>
);
