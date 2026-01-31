// components/ConversationHistory.tsx
/**
 * Sidebar component showing conversation history
 */

import React from 'react';
import { MessageSquare, Plus, Trash2, Clock } from 'lucide-react';
import type { Conversation } from '../services/conversationService';

interface ConversationHistoryProps {
    conversations: Conversation[];
    currentId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
    conversations,
    currentId,
    onSelect,
    onNew,
    onDelete,
    isOpen,
    onClose
}) => {
    if (!isOpen) return null;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Včera';
        } else if (days < 7) {
            return `${days} dní`;
        } else {
            return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
        }
    };

    return (
        <div className="fixed bottom-4 right-[420px] w-72 h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">Historie</span>
                </div>
                <button
                    onClick={onNew}
                    className="flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nový chat
                </button>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Zatím žádná historie</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {conversations.map((conv) => (
                            <div
                                key={conv.id}
                                onClick={() => onSelect(conv.id)}
                                className={`group p-3 cursor-pointer hover:bg-slate-50 transition-colors ${currentId === conv.id ? 'bg-emerald-50 border-l-2 border-emerald-500' : ''
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-800 truncate text-sm">
                                            {conv.title || 'Nová konverzace'}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                            <span>{formatDate(conv.last_message_at)}</span>
                                            <span>•</span>
                                            <span>{conv.message_count || 0} zpráv</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(conv.id);
                                        }}
                                        className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Smazat konverzaci"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50">
                <p className="text-xs text-slate-400 text-center">
                    {conversations.length} konverzací
                </p>
            </div>
        </div>
    );
};
