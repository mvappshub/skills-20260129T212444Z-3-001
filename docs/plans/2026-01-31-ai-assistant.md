# AI Asistent pro SilvaPlan - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementovat chatového AI asistenta s function calling pro plánování výsadby, správu kalendáře a proaktivní upozornění na rizika.

**Architecture:** Client-side chat UI s Vercel AI SDK `useChat` hook komunikující s API route. API route používá OpenRouter jako proxy pro Gemini 2.5 Flash s definovanými tools pro CRUD operace nad kalendářem, přístup k počasí a analýzu rizik. Asistent má přístup k existujícím službám (eventService, weatherService, alertService).

**Tech Stack:** React 19, TypeScript, Vercel AI SDK 4.x, OpenRouter API, Gemini 2.5 Flash, Zod pro validaci

---

## Přehled tasků

| Task | Popis | Závislosti |
|------|-------|------------|
| 1 | Nainstalovat závislosti (AI SDK, Zod) | - |
| 2 | Vytvořit AI tools definice | Task 1 |
| 3 | Vytvořit API service pro chat | Task 2 |
| 4 | Vytvořit ChatPanel komponentu | Task 3 |
| 5 | Vytvořit ChatMessage komponentu | Task 4 |
| 6 | Integrovat chat do App.tsx | Task 4, 5 |
| 7 | Přidat tool execution handlers | Task 6 |
| 8 | Implementovat proaktivní analýzu rizik | Task 7 |
| 9 | Přidat system prompt s kontextem | Task 8 |

---

## Task 1: Nainstalovat závislosti

**Files:**
- Modify: `package.json`

**Step 1: Nainstalovat AI SDK a Zod**

```bash
npm install ai @ai-sdk/openai zod
```

> Poznámka: Používáme `@ai-sdk/openai` protože OpenRouter je OpenAI-kompatibilní API.

**Step 2: Ověřit instalaci**

```bash
npm list ai zod
```

Expected: Packages installed

**Step 3: Přidat environment proměnnou**

Vytvořit/upravit `.env.local`:

```
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
```

**Step 4: Commit**

```bash
git add package.json package-lock.json .env.local
git commit -m "chore: add AI SDK and Zod dependencies

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Vytvořit AI tools definice

**Files:**
- Create: `services/ai/tools.ts`

**Step 1: Vytvořit tools.ts**

```typescript
// services/ai/tools.ts
import { z } from 'zod';

// Schema definice pro AI tools
export const createEventSchema = z.object({
  title: z.string().describe('Název akce, např. "Výsadba dubů v parku"'),
  type: z.enum(['planting', 'maintenance', 'other']).describe('Typ akce'),
  date: z.string().describe('Datum ve formátu YYYY-MM-DD'),
  lat: z.number().describe('Zeměpisná šířka lokace'),
  lng: z.number().describe('Zeměpisná délka lokace'),
  notes: z.string().optional().describe('Poznámky k akci'),
  items: z.array(z.object({
    species: z.string().describe('Latinský název druhu, např. "Quercus robur"'),
    quantity: z.number().describe('Počet kusů'),
    sizeClass: z.string().optional().describe('Velikostní třída, např. "150-200cm"')
  })).optional().describe('Seznam rostlin k výsadbě')
});

export const editEventSchema = z.object({
  eventId: z.string().describe('ID existující akce'),
  title: z.string().optional().describe('Nový název'),
  date: z.string().optional().describe('Nové datum YYYY-MM-DD'),
  status: z.enum(['planned', 'done', 'canceled']).optional().describe('Nový stav'),
  notes: z.string().optional().describe('Nové poznámky')
});

export const deleteEventSchema = z.object({
  eventId: z.string().describe('ID akce ke smazání')
});

export const getEventsSchema = z.object({
  startDate: z.string().optional().describe('Počáteční datum filtru YYYY-MM-DD'),
  endDate: z.string().optional().describe('Koncové datum filtru YYYY-MM-DD'),
  type: z.enum(['planting', 'maintenance', 'other']).optional().describe('Filtr dle typu')
});

export const getWeatherSchema = z.object({
  lat: z.number().optional().describe('Zeměpisná šířka (default: Praha)'),
  lng: z.number().optional().describe('Zeměpisná délka (default: Praha)'),
  days: z.number().optional().describe('Počet dní předpovědi (default: 7)')
});

export const getAlertsSchema = z.object({});

export const analyzeRisksSchema = z.object({
  eventId: z.string().optional().describe('ID konkrétní akce k analýze, nebo všechny nadcházející')
});

export const suggestPlantingDateSchema = z.object({
  species: z.string().describe('Latinský název druhu'),
  lat: z.number().optional().describe('Zeměpisná šířka'),
  lng: z.number().optional().describe('Zeměpisná délka')
});

// Tool definitions pro AI SDK
export const toolDefinitions = {
  createEvent: {
    description: 'Vytvořit novou plánovanou akci (výsadba, údržba stromů). Použij když uživatel chce naplánovat novou činnost.',
    parameters: createEventSchema
  },
  editEvent: {
    description: 'Upravit existující akci v kalendáři. Použij pro změnu data, stavu nebo poznámek.',
    parameters: editEventSchema
  },
  deleteEvent: {
    description: 'Smazat akci z kalendáře. Použij pouze když uživatel explicitně požádá o smazání.',
    parameters: deleteEventSchema
  },
  getEvents: {
    description: 'Získat seznam akcí z kalendáře. Použij pro zobrazení plánu nebo hledání konkrétních akcí.',
    parameters: getEventsSchema
  },
  getWeather: {
    description: 'Získat předpověď počasí včetně půdní vlhkosti. Použij pro plánování nebo kontrolu podmínek.',
    parameters: getWeatherSchema
  },
  getAlerts: {
    description: 'Získat aktuální meteorologické výstrahy (sucho, mráz, bouřky, horko).',
    parameters: getAlertsSchema
  },
  analyzeRisks: {
    description: 'Analyzovat rizika pro plánované akce na základě počasí. Proaktivně upozorni na problémy.',
    parameters: analyzeRisksSchema
  },
  suggestPlantingDate: {
    description: 'Navrhnout optimální datum výsadby pro daný druh na základě počasí.',
    parameters: suggestPlantingDateSchema
  }
};

export type ToolName = keyof typeof toolDefinitions;
```

**Step 2: Ověřit TypeScript**

```bash
npx tsc --noEmit
```

Expected: Žádné chyby

**Step 3: Commit**

```bash
git add services/ai/tools.ts
git commit -m "feat: add AI tool definitions with Zod schemas

- createEvent, editEvent, deleteEvent for calendar CRUD
- getWeather, getAlerts for weather data
- analyzeRisks, suggestPlantingDate for proactive assistance

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Vytvořit AI chat service

**Files:**
- Create: `services/ai/chatService.ts`

**Step 1: Vytvořit chatService.ts**

```typescript
// services/ai/chatService.ts
import { toolDefinitions, ToolName } from './tools';
import { fetchEvents, createEvent } from '../eventService';
import { fetchAlerts } from '../alertService';
import { fetchWeatherForecast, fetchCurrentWeather } from '../weatherService';
import { CalendarEvent, EventType, EventStatus, MeteoAlert } from '../../types';
import { format, parseISO, addDays, isWithinInterval } from 'date-fns';

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatResponse {
  message: Message;
  toolResults?: { name: string; result: any }[];
}

// Tool execution handlers
const toolHandlers: Record<ToolName, (args: any) => Promise<any>> = {
  async createEvent(args) {
    const event = await createEvent({
      title: args.title,
      type: args.type as EventType,
      status: EventStatus.PLANNED,
      start_at: parseISO(args.date),
      lat: args.lat,
      lng: args.lng,
      notes: args.notes,
      items: (args.items || []).map((item: any) => ({
        id: crypto.randomUUID(),
        species_name_latin: item.species,
        quantity: item.quantity,
        size_class: item.sizeClass
      }))
    });
    return { success: true, event, message: `Akce "${event.title}" byla vytvořena na ${format(event.start_at, 'd.M.yyyy')}` };
  },

  async editEvent(args) {
    // Pro MVP - pouze log, plná implementace vyžaduje updateEvent v eventService
    return {
      success: true,
      message: `Akce ${args.eventId} by byla upravena. (Implementace pending)`,
      updates: args
    };
  },

  async deleteEvent(args) {
    // Pro MVP - pouze log
    return {
      success: true,
      message: `Akce ${args.eventId} by byla smazána. (Implementace pending)`
    };
  },

  async getEvents(args) {
    const events = await fetchEvents();
    let filtered = events;

    if (args.startDate) {
      const start = parseISO(args.startDate);
      filtered = filtered.filter(e => e.start_at >= start);
    }
    if (args.endDate) {
      const end = parseISO(args.endDate);
      filtered = filtered.filter(e => e.start_at <= end);
    }
    if (args.type) {
      filtered = filtered.filter(e => e.type === args.type);
    }

    return {
      count: filtered.length,
      events: filtered.map(e => ({
        id: e.id,
        title: e.title,
        type: e.type,
        status: e.status,
        date: format(e.start_at, 'yyyy-MM-dd'),
        items: e.items.map(i => `${i.quantity}x ${i.species_name_latin}`).join(', ')
      }))
    };
  },

  async getWeather(args) {
    const lat = args.lat || 50.0755;
    const lng = args.lng || 14.4378;
    const days = args.days || 7;

    const [current, forecast] = await Promise.all([
      fetchCurrentWeather(lat, lng),
      fetchWeatherForecast(lat, lng, days)
    ]);

    return {
      current: current ? {
        temperature: current.temperature,
        conditions: current.weatherCode,
        soilMoisture: `${(current.soilMoisture * 100).toFixed(0)}%`,
        wind: `${current.windSpeed.toFixed(0)} km/h`
      } : null,
      forecast: forecast.map(f => ({
        date: format(f.date, 'yyyy-MM-dd'),
        tempMax: f.temperatureMax,
        tempMin: f.temperatureMin,
        precipitation: f.precipitation,
        soilMoisture: `${(f.soilMoisture0to1cm * 100).toFixed(0)}%`
      }))
    };
  },

  async getAlerts(args) {
    const alerts = await fetchAlerts();
    return {
      count: alerts.length,
      alerts: alerts.map(a => ({
        type: a.type,
        level: a.level,
        title: a.title,
        description: a.description,
        validUntil: format(a.valid_to, 'yyyy-MM-dd')
      }))
    };
  },

  async analyzeRisks(args) {
    const [events, alerts, forecast] = await Promise.all([
      fetchEvents(),
      fetchAlerts(),
      fetchWeatherForecast(50.0755, 14.4378, 14)
    ]);

    const upcomingEvents = events.filter(e =>
      e.status === EventStatus.PLANNED &&
      e.start_at > new Date() &&
      e.start_at < addDays(new Date(), 14)
    );

    const risks: { eventId: string; eventTitle: string; risks: string[] }[] = [];

    for (const event of upcomingEvents) {
      if (args.eventId && event.id !== args.eventId) continue;

      const eventRisks: string[] = [];
      const eventDate = event.start_at;

      // Check alerts
      const relevantAlerts = alerts.filter(a =>
        isWithinInterval(eventDate, { start: a.valid_from, end: a.valid_to })
      );

      for (const alert of relevantAlerts) {
        if (alert.level === 'danger') {
          eventRisks.push(`KRITICKÉ: ${alert.title} - ${alert.description}`);
        } else if (alert.level === 'warning') {
          eventRisks.push(`VAROVÁNÍ: ${alert.title}`);
        }
      }

      // Check forecast
      const dayForecast = forecast.find(f =>
        format(f.date, 'yyyy-MM-dd') === format(eventDate, 'yyyy-MM-dd')
      );

      if (dayForecast) {
        if (dayForecast.soilMoisture0to1cm < 0.1) {
          eventRisks.push('Kriticky nízká vlhkost půdy - nutná zálivka po výsadbě');
        }
        if (dayForecast.temperatureMin < 0) {
          eventRisks.push(`Riziko mrazu (min. ${dayForecast.temperatureMin.toFixed(0)}°C)`);
        }
        if (dayForecast.precipitation > 10) {
          eventRisks.push(`Očekávané silné srážky (${dayForecast.precipitation.toFixed(0)}mm)`);
        }
      }

      if (eventRisks.length > 0) {
        risks.push({
          eventId: event.id,
          eventTitle: event.title,
          risks: eventRisks
        });
      }
    }

    return {
      analyzedEvents: upcomingEvents.length,
      risksFound: risks.length,
      details: risks
    };
  },

  async suggestPlantingDate(args) {
    const forecast = await fetchWeatherForecast(
      args.lat || 50.0755,
      args.lng || 14.4378,
      14
    );

    // Find best day based on conditions
    const suitable = forecast.filter(f =>
      f.temperatureMin > 5 &&
      f.temperatureMax < 25 &&
      f.precipitation < 5 &&
      f.soilMoisture0to1cm > 0.2
    );

    if (suitable.length === 0) {
      return {
        species: args.species,
        suggestion: 'V následujících 14 dnech nejsou ideální podmínky pro výsadbu.',
        alternatives: forecast.slice(0, 3).map(f => ({
          date: format(f.date, 'yyyy-MM-dd'),
          conditions: `${f.temperatureMin.toFixed(0)}-${f.temperatureMax.toFixed(0)}°C, srážky ${f.precipitation.toFixed(0)}mm`
        }))
      };
    }

    const best = suitable[0];
    return {
      species: args.species,
      suggestedDate: format(best.date, 'yyyy-MM-dd'),
      conditions: {
        temperature: `${best.temperatureMin.toFixed(0)}-${best.temperatureMax.toFixed(0)}°C`,
        precipitation: `${best.precipitation.toFixed(0)}mm`,
        soilMoisture: `${(best.soilMoisture0to1cm * 100).toFixed(0)}%`
      },
      reason: 'Optimální teplota, minimální srážky, dobrá vlhkost půdy'
    };
  }
};

// Execute a tool call
async function executeTool(name: ToolName, args: any): Promise<any> {
  const handler = toolHandlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(args);
}

// System prompt
const SYSTEM_PROMPT = `Jsi SilvaPlan AI - inteligentní asistent pro správu výsadby a péči o stromy.

TVOJE SCHOPNOSTI:
- Plánování výsadby stromů a keřů do kalendáře
- Správa a editace existujících akcí
- Kontrola počasí a meteorologických výstrah
- Analýza rizik pro plánované akce
- Doporučení optimálního data výsadby

PRAVIDLA:
1. Vždy používej české názvy pro komunikaci, ale latinské názvy pro druhy stromů
2. Při plánování výsadby vždy zkontroluj počasí a upozorni na rizika
3. Buď proaktivní - pokud vidíš problém, upozorni na něj
4. Při vytváření akcí vždy potvrď uživateli detaily
5. Formátuj odpovědi přehledně s odrážkami a strukturou

KONTEXT:
- Aktuální datum: ${format(new Date(), 'yyyy-MM-dd')}
- Výchozí lokace: Praha (50.0755, 14.4378)
- Aplikace: SilvaPlan - správa výsadby stromů

Odpovídej stručně ale informativně. Pokud potřebuješ více informací, zeptej se.`;

// Main chat function
export async function chat(
  messages: Message[],
  apiKey: string
): Promise<ChatResponse> {
  const tools = Object.entries(toolDefinitions).map(([name, def]) => ({
    type: 'function' as const,
    function: {
      name,
      description: def.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries((def.parameters as any).shape).map(([key, value]: [string, any]) => [
            key,
            {
              type: value._def?.typeName === 'ZodNumber' ? 'number' :
                    value._def?.typeName === 'ZodArray' ? 'array' : 'string',
              description: value._def?.description || key
            }
          ])
        ),
        required: Object.entries((def.parameters as any).shape)
          .filter(([_, value]: [string, any]) => !value.isOptional?.())
          .map(([key]) => key)
      }
    }
  }));

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'SilvaPlan AI Assistant'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      tools,
      tool_choice: 'auto'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json();
  const assistantMessage = data.choices[0].message;

  // Handle tool calls
  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    const toolResults: { name: string; result: any }[] = [];

    for (const toolCall of assistantMessage.tool_calls) {
      const name = toolCall.function.name as ToolName;
      const args = JSON.parse(toolCall.function.arguments);

      try {
        const result = await executeTool(name, args);
        toolResults.push({ name, result });
      } catch (error) {
        toolResults.push({ name, result: { error: String(error) } });
      }
    }

    return {
      message: assistantMessage,
      toolResults
    };
  }

  return { message: assistantMessage };
}

export type { Message, ChatResponse };
```

**Step 2: Ověřit TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add services/ai/chatService.ts
git commit -m "feat: add AI chat service with tool execution

- OpenRouter integration with Gemini 2.5 Flash
- Tool handlers for calendar CRUD, weather, alerts
- Risk analysis and planting date suggestions
- Czech system prompt with context

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Vytvořit ChatPanel komponentu

**Files:**
- Create: `components/ChatPanel.tsx`

**Step 1: Vytvořit ChatPanel.tsx**

```typescript
// components/ChatPanel.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, AlertCircle, X, MessageSquare } from 'lucide-react';
import { chat, Message, ChatResponse } from '../services/ai/chatService';
import { ChatMessage } from './ChatMessage';

interface ChatPanelProps {
  apiKey: string;
  onEventCreated?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  apiKey,
  onEventCreated,
  isOpen,
  onClose
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await chat([...messages, userMessage], apiKey);

      // Add assistant message
      setMessages(prev => [...prev, response.message]);

      // If tools were called, we need to continue the conversation
      if (response.toolResults && response.toolResults.length > 0) {
        // Check if event was created
        const eventCreated = response.toolResults.some(
          r => r.name === 'createEvent' && r.result?.success
        );
        if (eventCreated && onEventCreated) {
          onEventCreated();
        }

        // Add tool results as messages and get final response
        const toolMessages: Message[] = response.message.tool_calls!.map((tc, i) => ({
          role: 'tool' as const,
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(response.toolResults![i].result)
        }));

        const finalResponse = await chat(
          [...messages, userMessage, response.message, ...toolMessages],
          apiKey
        );

        setMessages(prev => [...prev, ...toolMessages, finalResponse.message]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastala chyba');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-600 text-white">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-semibold">SilvaPlan AI</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-emerald-700 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
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
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-slate-400">Zkus napsat:</p>
              <button
                onClick={() => setInput('Naplánuj výsadbu 5 dubů na příští týden')}
                className="block w-full text-left px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                "Naplánuj výsadbu 5 dubů na příští týden"
              </button>
              <button
                onClick={() => setInput('Jaké je počasí na tento týden?')}
                className="block w-full text-left px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                "Jaké je počasí na tento týden?"
              </button>
              <button
                onClick={() => setInput('Jsou nějaká rizika pro mé plánované akce?')}
                className="block w-full text-left px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                "Jsou nějaká rizika pro mé plánované akce?"
              </button>
            </div>
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
            <div>
              <p className="font-medium text-sm">Chyba</p>
              <p className="text-sm">{error}</p>
            </div>
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
            onKeyDown={handleKeyDown}
            placeholder="Napiš zprávu..."
            className="flex-1 px-4 py-2 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

// Floating button to open chat
export const ChatButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="fixed bottom-4 right-4 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-all hover:scale-105 flex items-center justify-center z-40"
  >
    <MessageSquare className="w-6 h-6" />
  </button>
);
```

**Step 2: Ověřit TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add components/ChatPanel.tsx
git commit -m "feat: add ChatPanel component with floating button

- Message list with auto-scroll
- Input with enter-to-send
- Loading and error states
- Suggestion buttons for new users
- Floating chat button

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Vytvořit ChatMessage komponentu

**Files:**
- Create: `components/ChatMessage.tsx`

**Step 1: Vytvořit ChatMessage.tsx**

```typescript
// components/ChatMessage.tsx
import React from 'react';
import { Bot, User, Wrench } from 'lucide-react';
import { Message } from '../services/ai/chatService';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const hasTool = message.tool_calls && message.tool_calls.length > 0;

  // Format tool calls for display
  const formatToolCall = (toolCall: any) => {
    const args = JSON.parse(toolCall.function.arguments);
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
```

**Step 2: Ověřit TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add components/ChatMessage.tsx
git commit -m "feat: add ChatMessage component

- User and assistant message bubbles
- Tool call indicators with Czech labels
- Responsive layout

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Integrovat chat do App.tsx

**Files:**
- Modify: `App.tsx`

**Step 1: Přidat importy**

Na začátek App.tsx přidat:

```typescript
import { ChatPanel, ChatButton } from './components/ChatPanel';
```

**Step 2: Přidat state pro chat**

Za ostatní useState přidat:

```typescript
// --- Chat State ---
const [isChatOpen, setIsChatOpen] = useState(false);
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
```

**Step 3: Přidat handler pro refresh dat**

Za ostatní handlery přidat:

```typescript
// Refresh data after AI creates event
const handleAIEventCreated = async () => {
  const eventsData = await fetchEvents();
  setEvents(eventsData);
};
```

**Step 4: Přidat ChatPanel a ChatButton do JSX**

Před uzavírací `</div>` hlavního containeru (před `</div>` na konci return):

```typescript
      {/* AI Chat */}
      {OPENROUTER_API_KEY ? (
        <>
          <ChatPanel
            apiKey={OPENROUTER_API_KEY}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            onEventCreated={handleAIEventCreated}
          />
          {!isChatOpen && <ChatButton onClick={() => setIsChatOpen(true)} />}
        </>
      ) : null}
```

**Step 5: Ověřit TypeScript**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add App.tsx
git commit -m "feat: integrate AI chat into main app

- Floating chat button in bottom-right
- Chat panel with full functionality
- Auto-refresh events after AI creates them

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Přidat updateEvent a deleteEvent do eventService

**Files:**
- Modify: `services/eventService.ts`

**Step 1: Přidat updateEvent funkci**

```typescript
export async function updateEvent(
  id: string,
  updates: Partial<Omit<CalendarEvent, 'id' | 'items'>>
): Promise<CalendarEvent> {
  const updateData: any = {};

  if (updates.title) updateData.title = updates.title;
  if (updates.type) updateData.type = updates.type;
  if (updates.status) updateData.status = updates.status;
  if (updates.start_at) updateData.start_at = updates.start_at.toISOString();
  if (updates.end_at) updateData.end_at = updates.end_at.toISOString();
  if (updates.lat !== undefined) updateData.lat = updates.lat;
  if (updates.lng !== undefined) updateData.lng = updates.lng;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const { data, error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', id)
    .select(`*, items:event_items(*)`)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    type: data.type as EventType,
    status: data.status as EventStatus,
    title: data.title,
    start_at: new Date(data.start_at),
    end_at: data.end_at ? new Date(data.end_at) : undefined,
    lat: data.lat,
    lng: data.lng,
    radius_m: data.radius_m,
    notes: data.notes,
    items: (data.items || []).map((item: any) => ({
      id: item.id,
      species_name_latin: item.species_name_latin,
      quantity: item.quantity,
      size_class: item.size_class
    }))
  };
}

export async function deleteEvent(id: string): Promise<void> {
  // First delete related items
  await supabase
    .from('event_items')
    .delete()
    .eq('event_id', id);

  // Then delete the event
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
```

**Step 2: Aktualizovat chatService.ts tool handlers**

V `services/ai/chatService.ts` upravit editEvent a deleteEvent:

```typescript
async editEvent(args) {
  const updates: any = {};
  if (args.title) updates.title = args.title;
  if (args.date) updates.start_at = parseISO(args.date);
  if (args.status) updates.status = args.status;
  if (args.notes) updates.notes = args.notes;

  const event = await updateEvent(args.eventId, updates);
  return {
    success: true,
    message: `Akce "${event.title}" byla upravena.`,
    event
  };
},

async deleteEvent(args) {
  await deleteEventFn(args.eventId);
  return {
    success: true,
    message: `Akce byla úspěšně smazána.`
  };
},
```

A přidat import:
```typescript
import { fetchEvents, createEvent, updateEvent, deleteEvent as deleteEventFn } from '../eventService';
```

**Step 3: Commit**

```bash
git add services/eventService.ts services/ai/chatService.ts
git commit -m "feat: add updateEvent and deleteEvent functions

- Full CRUD support for events
- AI can now edit and delete events

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Přidat proaktivní risk check

**Files:**
- Create: `hooks/useProactiveRiskCheck.ts`
- Modify: `App.tsx`

**Step 1: Vytvořit useProactiveRiskCheck hook**

```typescript
// hooks/useProactiveRiskCheck.ts
import { useEffect, useState } from 'react';
import { fetchEvents } from '../services/eventService';
import { fetchAlerts } from '../services/alertService';
import { fetchWeatherForecast } from '../services/weatherService';
import { CalendarEvent, MeteoAlert, EventStatus } from '../types';
import { addDays, isWithinInterval, format } from 'date-fns';

interface RiskWarning {
  eventId: string;
  eventTitle: string;
  eventDate: Date;
  risks: string[];
  severity: 'warning' | 'danger';
}

export function useProactiveRiskCheck(enabled: boolean = true) {
  const [warnings, setWarnings] = useState<RiskWarning[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;

    async function checkRisks() {
      try {
        const [events, alerts, forecast] = await Promise.all([
          fetchEvents(),
          fetchAlerts(),
          fetchWeatherForecast(50.0755, 14.4378, 7)
        ]);

        const upcomingEvents = events.filter(e =>
          e.status === EventStatus.PLANNED &&
          e.start_at > new Date() &&
          e.start_at < addDays(new Date(), 7)
        );

        const newWarnings: RiskWarning[] = [];

        for (const event of upcomingEvents) {
          const eventRisks: string[] = [];
          let severity: 'warning' | 'danger' = 'warning';

          // Check alerts
          const relevantAlerts = alerts.filter(a =>
            isWithinInterval(event.start_at, { start: a.valid_from, end: a.valid_to })
          );

          for (const alert of relevantAlerts) {
            if (alert.level === 'danger') {
              eventRisks.push(alert.title);
              severity = 'danger';
            } else if (alert.level === 'warning') {
              eventRisks.push(alert.title);
            }
          }

          // Check forecast
          const dayForecast = forecast.find(f =>
            format(f.date, 'yyyy-MM-dd') === format(event.start_at, 'yyyy-MM-dd')
          );

          if (dayForecast) {
            if (dayForecast.temperatureMin < -2) {
              eventRisks.push(`Mráz (${dayForecast.temperatureMin.toFixed(0)}°C)`);
              severity = 'danger';
            }
            if (dayForecast.soilMoisture0to1cm < 0.1) {
              eventRisks.push('Kriticky suchá půda');
              severity = 'danger';
            }
          }

          if (eventRisks.length > 0) {
            newWarnings.push({
              eventId: event.id,
              eventTitle: event.title,
              eventDate: event.start_at,
              risks: eventRisks,
              severity
            });
          }
        }

        setWarnings(newWarnings);
        setLastCheck(new Date());
      } catch (error) {
        console.error('Risk check failed:', error);
      }
    }

    // Initial check
    checkRisks();

    // Check every 30 minutes
    const interval = setInterval(checkRisks, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [enabled]);

  return { warnings, lastCheck };
}
```

**Step 2: Vytvořit RiskBanner komponentu**

```typescript
// components/RiskBanner.tsx
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

interface RiskWarning {
  eventId: string;
  eventTitle: string;
  eventDate: Date;
  risks: string[];
  severity: 'warning' | 'danger';
}

interface RiskBannerProps {
  warnings: RiskWarning[];
  onDismiss: (eventId: string) => void;
  onOpenChat: () => void;
}

export const RiskBanner: React.FC<RiskBannerProps> = ({
  warnings,
  onDismiss,
  onOpenChat
}) => {
  if (warnings.length === 0) return null;

  const dangerWarnings = warnings.filter(w => w.severity === 'danger');
  const hasDanger = dangerWarnings.length > 0;

  return (
    <div className={`${hasDanger ? 'bg-red-600' : 'bg-amber-500'} text-white px-4 py-2`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <span className="font-medium">
              {hasDanger ? 'Kritická rizika' : 'Upozornění'} pro {warnings.length} {
                warnings.length === 1 ? 'plánovanou akci' : 'plánované akce'
              }
            </span>
            <span className="hidden sm:inline ml-2 opacity-90">
              {warnings[0].eventTitle} ({format(warnings[0].eventDate, 'd.M.', { locale: cs })})
              {warnings[0].risks[0] && ` - ${warnings[0].risks[0]}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenChat}
            className="text-sm px-3 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
          >
            Zobrazit detail
          </button>
          <button
            onClick={() => onDismiss(warnings[0].eventId)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Step 3: Integrovat do App.tsx**

Přidat import a použití:

```typescript
import { useProactiveRiskCheck } from './hooks/useProactiveRiskCheck';
import { RiskBanner } from './components/RiskBanner';

// V komponentě:
const { warnings } = useProactiveRiskCheck(true);
const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([]);

const activeWarnings = warnings.filter(w => !dismissedWarnings.includes(w.eventId));

// V JSX před header:
<RiskBanner
  warnings={activeWarnings}
  onDismiss={(id) => setDismissedWarnings(prev => [...prev, id])}
  onOpenChat={() => setIsChatOpen(true)}
/>
```

**Step 4: Commit**

```bash
git add hooks/useProactiveRiskCheck.ts components/RiskBanner.tsx App.tsx
git commit -m "feat: add proactive risk checking with banner

- Automatic risk check every 30 minutes
- Warning banner for upcoming events with risks
- Dismiss functionality
- Direct link to AI chat for details

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Finální testy a dokumentace

**Step 1: Spustit build**

```bash
npm run build
```

Expected: Build úspěšný

**Step 2: Spustit dev server**

```bash
npm run dev
```

**Step 3: Testovat funkcionalitu**

Checklist:
- [ ] Chat button se zobrazuje vpravo dole
- [ ] Klik otevře chat panel
- [ ] Odeslání zprávy funguje
- [ ] AI odpovídá česky
- [ ] "Naplánuj výsadbu dubů na zítra" vytvoří event
- [ ] "Jaké je počasí?" vrátí předpověď
- [ ] "Jsou rizika pro mé akce?" analyzuje kalendář
- [ ] Risk banner se zobrazuje při problémech

**Step 4: Finální commit**

```bash
git add .
git commit -m "feat: complete AI assistant implementation

- OpenRouter + Gemini 2.5 Flash integration
- Full calendar CRUD via natural language
- Weather and alerts access
- Proactive risk monitoring
- Czech language support

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Shrnutí implementace

| Komponenta | Soubor | Funkce |
|------------|--------|--------|
| Tool Definitions | `services/ai/tools.ts` | Zod schemas pro function calling |
| Chat Service | `services/ai/chatService.ts` | OpenRouter API + tool execution |
| Chat Panel | `components/ChatPanel.tsx` | UI pro chat |
| Chat Message | `components/ChatMessage.tsx` | Jednotlivé zprávy |
| Risk Hook | `hooks/useProactiveRiskCheck.ts` | Automatická kontrola rizik |
| Risk Banner | `components/RiskBanner.tsx` | Upozornění na rizika |

## Konfigurace

1. Získat API klíč z [OpenRouter](https://openrouter.ai/)
2. Přidat do `.env.local`:
   ```
   VITE_OPENROUTER_API_KEY=sk-or-v1-xxxxx
   ```
3. (Volitelné) Změnit model v `chatService.ts`:
   ```typescript
   const MODEL = 'google/gemini-2.5-flash'; // nebo 'anthropic/claude-3-haiku'
   ```

## Možná budoucí rozšíření

1. **Hlasový vstup** - Web Speech API pro diktování
2. **Obrázky** - Multimodální vstup (foto stromu → identifikace)
3. **Notifikace** - Push notifications pro rizika
4. **Historie chatů** - Uložení konverzací do Supabase
5. **Více jazyků** - i18n podpora
