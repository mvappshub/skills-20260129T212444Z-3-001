// components/ChatMessage.tsx
import React from 'react';
import { Bot, User, Wrench } from 'lucide-react';
import { Message } from '../services/ai/chatService';

interface ChatMessageProps {
  message: Message;
}

// Helper to get Czech labels for tools
function getToolLabel(name: string): string {
  const labels: Record<string, string> = {
    createEvent: 'Vytvářím akci',
    editEvent: 'Upravuji akci',
    deleteEvent: 'Mažu akci',
    getEvents: 'Načítám akce',
    getWeather: 'Kontroluji počasí',
    getAlerts: 'Kontroluji výstrahy',
    analyzeRisks: 'Analyzuji rizika',
    suggestPlantingDate: 'Hledám vhodný termín'
  };
  return labels[name] || name;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const hasTool = message.tool_calls && message.tool_calls.length > 0;

  // Format tool calls for display
  const formatToolCall = (toolCall: any) => {
    let args: any = {};
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      args = {};
    }
    return {
      name: toolCall.function.name,
      args
    };
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Text content */}
        {message.content && (
          <div className={`px-4 py-2 rounded-2xl ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-slate-100 text-slate-800 rounded-bl-md'
          }`}>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        )}

        {/* Tool calls */}
        {hasTool && (
          <div className="space-y-2">
            {message.tool_calls!.map((tc, i) => {
              const { name, args } = formatToolCall(tc);
              return (
                <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-50 text-amber-800 rounded-lg text-xs">
                  <Wrench className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{getToolLabel(name)}</span>
                    {name === 'createEvent' && args.title && (
                      <p className="text-amber-600 mt-0.5">"{args.title}"</p>
                    )}
                    {name === 'getWeather' && (
                      <p className="text-amber-600 mt-0.5">Kontrola počasí...</p>
                    )}
                    {name === 'analyzeRisks' && (
                      <p className="text-amber-600 mt-0.5">Analyzuji rizika...</p>
                    )}
                    {name === 'getEvents' && (
                      <p className="text-amber-600 mt-0.5">Načítám kalendář...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
