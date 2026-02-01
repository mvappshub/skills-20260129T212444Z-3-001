// services/ai/chatService.ts
/**
 * SilvaPlan AI Chat Service
 *
 * Supports multiple AI providers (OpenRouter, Google Gemini) with dynamic model selection.
 * Uses localStorage for API key management via settingsService.
 *
 * Best Practices based on:
 * - OpenRouter: https://openrouter.ai/docs
 * - Gemini API: https://ai.google.dev/gemini-api/docs
 */

import { ToolName } from './tools';
import { fetchEvents, createEvent, updateEvent, deleteEvent as deleteEventFn } from '../eventService';
import { fetchAlerts } from '../alertService';
import { fetchWeatherForecast, fetchCurrentWeather } from '../weatherService';
import { EventType, EventStatus } from '../../types';
import { format, parseISO, addDays, isWithinInterval } from 'date-fns';
import {
  getProviderConfig,
  getActiveApiKey,
  type OpenRouterModel,
  GEMINI_MODELS
} from '../settingsService';

// ============================================================================
// Types
// ============================================================================

// Import from shared types to avoid circular dependency with settingsService
import type { AIProvider } from './types';
export type { AIProvider };

export interface MessageAttachment {
  type: 'image' | 'document';
  mimeType: string;
  base64?: string; // For images
  textContent?: string; // For documents (extracted text)
  url?: string;
  name?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  attachments?: MessageAttachment[];
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatResponse {
  message: Message;
  toolResults?: { name: string; result: any }[];
}

// ============================================================================
// Provider Configuration
// ============================================================================

interface ProviderConfig {
  formatRequest: (messages: Message[], tools: any[], systemPrompt: string, modelId: string) => any;
  parseResponse: (data: any) => { content: string; tool_calls?: ToolCall[] };
}

const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  // ========================================================================
  // OpenRouter Provider
  // Based on: https://openrouter.ai/docs/api-reference
  // ========================================================================
  openrouter: {
    formatRequest: (messages, tools, systemPrompt, modelId) => ({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => {
          // For messages with attachments, use content array format
          if (m.role === 'user' && m.attachments?.length) {
            const contentParts: any[] = [{ type: 'text', text: m.content }];
            for (const attachment of m.attachments) {
              if (attachment.type === 'image' && attachment.base64) {
                contentParts.push({
                  type: 'image_url',
                  image_url: {
                    url: `data:${attachment.mimeType};base64,${attachment.base64}`
                  }
                });
              } else if (attachment.type === 'document' && attachment.textContent) {
                // Add document content as additional text
                contentParts.push({
                  type: 'text',
                  text: `\n\n--- Dokument: ${attachment.name || 'soubor'} ---\n${attachment.textContent}\n--- Konec dokumentu ---\n`
                });
              }
            }
            return { role: m.role, content: contentParts };
          }

          return {
            role: m.role,
            content: m.content,
            ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
            ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
            ...(m.name ? { name: m.name } : {})
          };
        })
      ],
      tools,
      tool_choice: 'auto'
    }),
    parseResponse: (data) => {
      const msg = data.choices?.[0]?.message;
      return {
        content: msg?.content || '',
        tool_calls: msg?.tool_calls
      };
    }
  },

  // ========================================================================
  // Gemini Provider (Direct API)
  // Based on: https://ai.google.dev/gemini-api/docs
  // Note: gemini-2.0-flash is deprecated March 2026, using gemini-2.5-flash
  // ========================================================================
  gemini: {
    formatRequest: (messages, tools, systemPrompt, modelId) => {
      // Convert OpenAI format to Gemini format
      const contents: any[] = [];

      // Add conversation history
      for (const msg of messages) {
        if (msg.role === 'user') {
          const parts: any[] = [{ text: msg.content }];

          // Add image attachments for vision
          if (msg.attachments?.length) {
            for (const attachment of msg.attachments) {
              if (attachment.type === 'image' && attachment.base64) {
                parts.push({
                  inlineData: {
                    mimeType: attachment.mimeType,
                    data: attachment.base64
                  }
                });
              } else if (attachment.type === 'document' && attachment.textContent) {
                // Add document content as text with filename context
                parts.push({
                  text: `\n\n--- Dokument: ${attachment.name || 'soubor'} ---\n${attachment.textContent}\n--- Konec dokumentu ---\n`
                });
              }
            }
          }

          contents.push({ role: 'user', parts });
        } else if (msg.role === 'assistant') {
          const parts: any[] = [];
          if (msg.content) {
            parts.push({ text: msg.content });
          }
          if (msg.tool_calls) {
            for (const tc of msg.tool_calls) {
              parts.push({
                functionCall: {
                  name: tc.function.name,
                  args: JSON.parse(tc.function.arguments)
                }
              });
            }
          }
          if (parts.length > 0) {
            contents.push({ role: 'model', parts });
          }
        } else if (msg.role === 'tool') {
          contents.push({
            role: 'user',
            parts: [{
              functionResponse: {
                name: msg.name,
                response: JSON.parse(msg.content)
              }
            }]
          });
        }
      }

      // Convert tools to Gemini format
      const geminiTools = [{
        functionDeclarations: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }))
      }];

      return {
        contents,
        tools: geminiTools,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      };
    },
    parseResponse: (data) => {
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let content = '';
      const tool_calls: ToolCall[] = [];

      for (const part of parts) {
        if (part.text) {
          content += part.text;
        }
        if (part.functionCall) {
          tool_calls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {})
            }
          });
        }
      }

      return { content, tool_calls: tool_calls.length > 0 ? tool_calls : undefined };
    }
  }
};

// ============================================================================
// Tool Execution Handlers
// ============================================================================

const toolHandlers: Record<ToolName, (args: any) => Promise<any>> = {
  async createEvent(args) {
    const event = await createEvent({
      title: args.title,
      type: args.type as EventType,
      status: EventStatus.PLANNED,
      start_at: parseISO(args.date),
      lat: args.lat || 50.0755,
      lng: args.lng || 14.4378,
      notes: args.notes,
      items: (args.items || []).map((item: any) => ({
        id: crypto.randomUUID(),
        species_name_latin: item.species,
        quantity: item.quantity,
        size_class: item.sizeClass
      }))
    });
    return {
      success: true,
      event: {
        id: event.id,
        title: event.title,
        date: format(event.start_at, 'd.M.yyyy'),
        type: event.type
      },
      message: `Akce "${event.title}" byla vytvořena na ${format(event.start_at, 'd.M.yyyy')}`
    };
  },

  async editEvent(args) {
    try {
      const updates: any = {};
      if (args.title) updates.title = args.title;
      if (args.date) updates.start_at = parseISO(args.date);
      if (args.status) updates.status = args.status;
      if (args.notes) updates.notes = args.notes;

      const event = await updateEvent(args.eventId, updates);
      return {
        success: true,
        message: `Akce "${event.title}" byla upravena.`,
        event: {
          id: event.id,
          title: event.title,
          status: event.status
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Nepodařilo se upravit akci: ${error}`
      };
    }
  },

  async deleteEvent(args) {
    try {
      await deleteEventFn(args.eventId);
      return {
        success: true,
        message: `Akce byla úspěšně smazána.`
      };
    } catch (error) {
      return {
        success: false,
        message: `Nepodařilo se smazat akci: ${error}`
      };
    }
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
        displayDate: format(e.start_at, 'd.M.yyyy'),
        items: e.items.map(i => `${i.quantity}x ${i.species_name_latin}`).join(', ') || 'bez položek'
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
        temperature: `${current.temperature.toFixed(1)}°C`,
        soilMoisture: `${(current.soilMoisture * 100).toFixed(0)}%`,
        wind: `${current.windSpeed.toFixed(0)} km/h`,
        precipitation: `${current.precipitation.toFixed(1)} mm`
      } : null,
      forecast: forecast.map(f => ({
        date: format(f.date, 'd.M.'),
        tempMax: `${f.temperatureMax.toFixed(0)}°C`,
        tempMin: `${f.temperatureMin.toFixed(0)}°C`,
        precipitation: `${f.precipitation.toFixed(1)} mm`,
        soilMoisture: `${(f.soilMoisture0to1cm * 100).toFixed(0)}%`
      }))
    };
  },

  async getAlerts(_args) {
    const alerts = await fetchAlerts();
    return {
      count: alerts.length,
      alerts: alerts.map(a => ({
        type: a.type,
        level: a.level,
        title: a.title,
        description: a.description,
        validUntil: format(a.valid_to, 'd.M.yyyy')
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

    const risks: { eventId: string; eventTitle: string; eventDate: string; risks: string[] }[] = [];

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
        if (dayForecast.temperatureMax > 30) {
          eventRisks.push(`Příliš vysoká teplota (${dayForecast.temperatureMax.toFixed(0)}°C) - stres pro sazenice`);
        }
      }

      if (eventRisks.length > 0) {
        risks.push({
          eventId: event.id,
          eventTitle: event.title,
          eventDate: format(event.start_at, 'd.M.yyyy'),
          risks: eventRisks
        });
      }
    }

    if (risks.length === 0) {
      return {
        analyzedEvents: upcomingEvents.length,
        message: 'Žádná rizika nebyla nalezena pro nadcházející akce.'
      };
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
          date: format(f.date, 'd.M.yyyy'),
          conditions: `${f.temperatureMin.toFixed(0)}-${f.temperatureMax.toFixed(0)}°C, srážky ${f.precipitation.toFixed(0)}mm`
        }))
      };
    }

    const best = suitable[0];
    return {
      species: args.species,
      suggestedDate: format(best.date, 'd.M.yyyy'),
      isoDate: format(best.date, 'yyyy-MM-dd'),
      conditions: {
        temperature: `${best.temperatureMin.toFixed(0)} až ${best.temperatureMax.toFixed(0)}°C`,
        precipitation: `${best.precipitation.toFixed(0)} mm`,
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

// ============================================================================
// System Prompt
// ============================================================================

function getSystemPrompt(): string {
  return `Jsi SilvaPlan AI - inteligentní asistent pro správu výsadby a péči o stromy.

TVOJE SCHOPNOSTI:
- Plánování výsadby stromů a keřů do kalendáře
- Správa a editace existujících akcí
- Kontrola počasí a meteorologických výstrah
- Analýza rizik pro plánované akce
- Doporučení optimálního data výsadby

PRAVIDLA:
1. Vždy používej české názvy pro komunikaci, ale latinské názvy pro druhy stromů (např. Quercus robur pro dub letní)
2. Při plánování výsadby VŽDY nejdříve zkontroluj počasí pomocí getWeather a upozorni na případná rizika
3. Buď proaktivní - pokud vidíš problém, upozorni na něj
4. Při vytváření akcí vždy potvrď uživateli detaily
5. Formátuj odpovědi přehledně s odrážkami
6. Pokud uživatel nespecifikuje lokaci, použij výchozí Praha (lat: 50.0755, lng: 14.4378)
7. Pokud uživatel nespecifikuje druh stromu, zeptej se

LATINSKÉ NÁZVY BĚŽNÝCH DRUHŮ:
- Dub letní = Quercus robur
- Dub zimní = Quercus petraea
- Lípa srdčitá = Tilia cordata
- Javor mléč = Acer platanoides
- Buk lesní = Fagus sylvatica
- Bříza bělokorá = Betula pendula
- Jasan ztepilý = Fraxinus excelsior
- Habr obecný = Carpinus betulus
- Jeřáb ptačí = Sorbus aucuparia
- Borovice lesní = Pinus sylvestris
- Smrk ztepilý = Picea abies

KONTEXT:
- Aktuální datum: ${format(new Date(), 'd.M.yyyy')}
- Výchozí lokace: Praha (50.0755, 14.4378)

Odpovídej stručně ale informativně. Pokud potřebuješ více informací, zeptej se.`;
}

// ============================================================================
// Zod to JSON Schema Converter
// ============================================================================

import { zodToJsonSchema as zodToJson } from 'zod-to-json-schema';

function zodToJsonSchema(schema: any): any {
  try {
    const jsonSchema = zodToJson(schema, { target: 'openApi3' });
    // Remove $schema key as it's not needed for tool definitions
    const { $schema, ...rest } = jsonSchema as any;
    return rest;
  } catch (error) {
    console.error('[ChatService] Failed to convert Zod schema:', error);
    return { type: 'object', properties: {} };
  }
}

// ============================================================================
// Main Chat Function
// ============================================================================

/**
 * Main chat function that routes requests to the configured AI provider.
 *
 * @param messages - Conversation history
 * @param overrideProvider - Optional provider override (for testing)
 * @param overrideApiKey - Optional API key override (for testing)
 * @param overrideModelId - Optional model ID override (for testing)
 *
 * @returns ChatResponse with assistant message and optional tool results
 *
 * @throws Error if API key is not configured or API call fails
 */
export async function chat(
  messages: Message[],
  overrideProvider?: AIProvider,
  overrideApiKey?: string,
  overrideModelId?: string
): Promise<ChatResponse> {
  // Get config from localStorage (via settingsService)
  const config = getProviderConfig();
  const actualApiKey = overrideApiKey || getActiveApiKey();

  if (!actualApiKey) {
    throw new Error(
      'Chybí API klíč. Prosím nastavte API klíč v nastavení (klikněte na ikonu ozubeného kola).'
    );
  }

  const actualProvider = overrideProvider || config?.provider || 'openrouter';
  const actualModelId = overrideModelId || config?.modelId || 'google/gemini-3-flash-preview';

  const providerConfig = PROVIDER_CONFIGS[actualProvider];
  if (!providerConfig) {
    throw new Error(`Neznámý provider: ${actualProvider}`);
  }

  // Determine API URL
  let apiUrl: string;
  if (actualProvider === 'openrouter') {
    apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  } else {
    // Gemini - use the API URL from model config
    const geminiModel = GEMINI_MODELS.find(m => m.id === actualModelId);
    apiUrl = geminiModel?.apiUrl || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  }

  // Dynamically import tools
  const { toolDefinitions } = await import('./tools');

  const tools = Object.entries(toolDefinitions).map(([name, def]) => ({
    type: 'function' as const,
    function: {
      name,
      description: def.description,
      parameters: zodToJsonSchema(def.parameters)
    }
  }));

  const systemPrompt = getSystemPrompt();
  const requestBody = providerConfig.formatRequest(messages, tools, systemPrompt, actualModelId);

  // Prepare headers based on provider
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (actualProvider === 'openrouter') {
    headers['Authorization'] = `Bearer ${actualApiKey}`;
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    headers['X-Title'] = 'SilvaPlan AI Assistant';
  } else {
    headers['x-goog-api-key'] = actualApiKey;
  }

  // Make API request with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ChatService] API Error:', response.status, errorText);

      // Provide more helpful error messages
      if (response.status === 401) {
        throw new Error('Neplatný API klíč. Prosím zkontrolujte nastavení.');
      } else if (response.status === 429) {
        throw new Error('Překročen limit požadavků. Zkuste to znovu za pár minut.');
      } else if (response.status === 400) {
        throw new Error('Neplatný požadavek. Možná model nepodporuje funkce, které používáte.');
      }

      throw new Error(`API chyba (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const { content, tool_calls } = providerConfig.parseResponse(data);

    // Handle tool calls
    if (tool_calls && tool_calls.length > 0) {
      const toolResults: { name: string; result: any }[] = [];

      for (const toolCall of tool_calls) {
        const name = toolCall.function.name as ToolName;
        let args: any;

        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          console.error('[ChatService] Failed to parse tool arguments:', toolCall.function.arguments);
          args = {};
        }

        try {
          const result = await executeTool(name, args);
          toolResults.push({ name, result });
        } catch (error) {
          console.error('[ChatService] Tool execution error:', name, error);
          toolResults.push({ name, result: { error: String(error) } });
        }
      }

      return {
        message: {
          role: 'assistant',
          content: content || '',
          tool_calls
        },
        toolResults
      };
    }

    return {
      message: {
        role: 'assistant',
        content: content || ''
      }
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Požadavek trval příliš dlouho. Zkuste to znovu.');
    }
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if AI is configured and ready to use
 */
export function isAIConfigured(): boolean {
  return getActiveApiKey() !== null;
}

/**
 * Get current provider and model info
 */
export function getCurrentModelInfo(): { provider: AIProvider; modelId: string } | null {
  const config = getProviderConfig();
  if (!config) return null;
  return {
    provider: config.provider,
    modelId: config.modelId
  };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getActiveApiKey from settingsService instead
 */
export function getAIConfig(): { provider: AIProvider; apiKey: string } | null {
  const apiKey = getActiveApiKey();
  const config = getProviderConfig();

  if (!apiKey || !config) return null;

  return {
    provider: config.provider,
    apiKey
  };
}
