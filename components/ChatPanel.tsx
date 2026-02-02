// components/ChatPanel.tsx
/**
 * Chat Panel for SilvaPlan AI Assistant
 *
 * Provides conversational interface for AI assistant with tool calling support.
 * API keys are managed via settings modal (localStorage).
 * Conversations are persisted to Supabase.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, AlertCircle, X, MessageSquare, Settings, History, Plus, Trash2, Paperclip, Image as ImageIcon, FileText } from 'lucide-react';
import { chat, Message, ChatResponse, isAIConfigured, MessageAttachment } from '../services/ai/chatService';
import { ChatMessage } from './ChatMessage';
import { SettingsModal } from './SettingsModal';
import { ConversationHistory } from './ConversationHistory';
import { useConversation } from '../hooks/useConversation';
import { logAgentAction, deleteConversation } from '../services/conversationService';
import { isImageFile, isDocumentFile, isTextReadable, fileToBase64, fileToText, isAllowedFileType, getFileExtension } from '../services/fileUploadService';
import { extractTextFromPDF, isPDF } from '../services/pdfService';
import { extractTextFromDocx, isDocx, isDoc } from '../services/docxService';
import { globalMapContext } from '../services/ai/mapContext';
import { debugLog } from '../services/debug';

interface MapContextProp {
  viewState?: { lat: number; lng: number; zoom?: number } | null;
  pickedLocation?: { lat: number; lng: number } | null;
}

interface ChatPanelProps {
  onEventCreated?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  mapContext?: MapContextProp;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  onEventCreated,
  isOpen,
  onClose,
  onOpenSettings,
  mapContext
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
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Sync map context with globalMapContext bridge for AI tools
  useEffect(() => {
    debugLog('📍 [ChatPanel] MAP CONTEXT PROP CHANGED:', JSON.stringify(mapContext, null, 2));
    if (mapContext) {
      const contextToSet = {
        currentView: mapContext.viewState ? {
          lat: mapContext.viewState.lat,
          lng: mapContext.viewState.lng,
          zoom: mapContext.viewState.zoom || 12
        } : null,
        pickedLocation: mapContext.pickedLocation || null
      };
      debugLog('📍 [ChatPanel] SETTING GLOBAL MAP CONTEXT:', JSON.stringify(contextToSet, null, 2));
      globalMapContext.setContext(contextToSet);
    } else {
      debugLog('📍 [ChatPanel] mapContext is null/undefined');
    }
  }, [mapContext]);

  const handleOpenSettings = () => {
    setShowSettings(true);
    onOpenSettings?.();
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // File upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setIsUploading(true);
    setError(null);

    try {
      const fileArray = Array.from(files) as File[];
      for (const file of fileArray) {
        // Validate file type
        if (!isAllowedFileType(file.type)) {
          setError(`Nepodporovaný typ souboru: ${file.name}. Povolené jsou obrázky, PDF, Word, Excel, CSV a textové soubory.`);
          continue;
        }

        let attachment: MessageAttachment;

        if (isImageFile(file.type)) {
          // Handle images - convert to base64
          const base64 = await fileToBase64(file);
          attachment = {
            type: 'image',
            mimeType: file.type,
            base64,
            name: file.name
          };
        } else if (isPDF(file.type)) {
          // Handle PDF files - extract text using pdf.js
          try {
            const textContent = await extractTextFromPDF(file);
            attachment = {
              type: 'document',
              mimeType: file.type,
              textContent,
              name: file.name
            };
          } catch (err) {
            setError(`Nepodařilo se přečíst PDF "${file.name}": ${err instanceof Error ? err.message : 'neznámá chyba'}`);
            continue;
          }
        } else if (isDocx(file.type)) {
          // Handle Word documents (.docx) - extract text using mammoth
          try {
            const textContent = await extractTextFromDocx(file);
            attachment = {
              type: 'document',
              mimeType: file.type,
              textContent,
              name: file.name
            };
          } catch (err) {
            setError(`Nepodařilo se přečíst Word dokument "${file.name}": ${err instanceof Error ? err.message : 'neznámá chyba'}`);
            continue;
          }
        } else if (isDoc(file.type)) {
          // Old .doc format - not supported by mammoth
          setError(`Starý formát Word (.doc) není podporován. Prosím uložte dokument "${file.name}" jako .docx`);
          continue;
        } else if (isTextReadable(file.type)) {
          // Handle text-based files - read content directly
          const textContent = await fileToText(file);
          attachment = {
            type: 'document',
            mimeType: file.type,
            textContent,
            name: file.name
          };
        } else {
          // Handle other binary documents (Excel, etc.)
          setError(`Soubor "${file.name}" má nepodporovaný formát pro přímé čtení. Podporované formáty: obrázky, PDF, Word (.docx), a textové soubory.`);
          continue;
        }

        setPendingAttachments(prev => [...prev, attachment]);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Nepodařilo se nahrát soubor');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove pending attachment
  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && pendingAttachments.length === 0) || isLoading) return;

    // Check if configured
    if (!isAIConfigured()) {
      setError(
        'AI asistent není nakonfigurován. Klikněte na ikonu nastavení (ozubené kolo) pro nastavení API klíče.'
      );
      return;
    }

    // Determine default content based on attachments
    const hasImages = pendingAttachments.some(a => a.type === 'image');
    const hasDocs = pendingAttachments.some(a => a.type === 'document');
    let defaultContent = '';
    if (pendingAttachments.length > 0 && !input.trim()) {
      if (hasDocs && !hasImages) {
        defaultContent = 'Analyzuj přiložený dokument';
      } else if (hasImages && !hasDocs) {
        defaultContent = 'Analyzuj přiložený obrázek';
      } else {
        defaultContent = 'Analyzuj přiložené soubory';
      }
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim() || defaultContent,
      attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined
    };
    const userContent = input.trim() || defaultContent;
    setInput('');
    setPendingAttachments([]);
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
              onClick={() => setShowHistory(!showHistory)}
              className={`p-1.5 hover:bg-white/20 rounded-lg transition-colors ${showHistory ? 'bg-white/20' : ''}`}
              title="Historie konverzací"
            >
              <History className="w-4 h-4" />
            </button>
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
          {/* Pending Attachments Preview */}
          {pendingAttachments.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {pendingAttachments.map((attachment, index) => (
                <div
                  key={index}
                  className="relative group rounded-lg overflow-hidden border border-slate-200"
                >
                  {attachment.type === 'image' && attachment.base64 ? (
                    <img
                      src={`data:${attachment.mimeType};base64,${attachment.base64}`}
                      alt={attachment.name || 'Příloha'}
                      className="w-16 h-16 object-cover"
                    />
                  ) : (
                    <div className="w-auto h-16 px-3 flex items-center gap-2 bg-slate-50">
                      <FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />
                      <span className="text-xs text-slate-600 max-w-24 truncate">{attachment.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv,.json,.md,.odt,.ods"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex gap-2">
            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading || !configured}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Přidat soubor (obrázek, dokument, tabulka)"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Paperclip className="w-5 h-5" />
              )}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={!configured ? "Nejprve nastavte API klíč..." : pendingAttachments.length > 0 ? "Přidej popis..." : "Napiš zprávu..."}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
              disabled={isLoading || !configured}
            />
            <button
              type="submit"
              disabled={(!input.trim() && pendingAttachments.length === 0) || isLoading || !configured}
              className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Conversation History Sidebar */}
      <ConversationHistory
        conversations={conversations}
        currentId={currentConversationId}
        onSelect={handleLoadConversation}
        onNew={handleNewChat}
        onDelete={async (id) => {
          await deleteConversation(id);
          if (id === currentConversationId) {
            await startNewConversation();
          }
          await refreshConversations();
        }}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

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
