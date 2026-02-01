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
import { globalMapContext } from './mapContext';
import { fetchEvents, createEvent, updateEvent, deleteEvent as deleteEventFn } from '../eventService';
import { fetchAlerts } from '../alertService';
import { fetchWeatherForecast, fetchCurrentWeather } from '../weatherService';
import { EventType, EventStatus } from '../../types';
import { format, parseISO, addDays, isWithinInterval } from 'date-fns';
import {
  getProviderConfig,
  getActiveApiKey,
  getDefaultLocation,
  type OpenRouterModel,
  GEMINI_MODELS
} from '../settingsService';

// Debug logging - ALWAYS ON for debugging
const DEBUG = true;
const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.warn('[🌲 SilvaPlan AI]', ...args);
  }
};

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
          let parsedContent: any;
          try {
            parsedContent = JSON.parse(msg.content);
          } catch {
            parsedContent = { raw: msg.content };
          }
          contents.push({
            role: 'user',
            parts: [{
              functionResponse: {
                name: msg.name,
                response: parsedContent
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
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
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

// Species-specific planting conditions
const SPECIES_CONDITIONS: Record<string, {
  tempMin: number;
  tempMax: number;
  moistureMin: number;
  frostSensitive: boolean;
}> = {
  'quercus robur': { tempMin: 5, tempMax: 25, moistureMin: 0.2, frostSensitive: true },
  'quercus petraea': { tempMin: 5, tempMax: 25, moistureMin: 0.2, frostSensitive: true },
  'tilia cordata': { tempMin: 5, tempMax: 22, moistureMin: 0.25, frostSensitive: true },
  'acer platanoides': { tempMin: 5, tempMax: 23, moistureMin: 0.2, frostSensitive: true },
  'fagus sylvatica': { tempMin: 5, tempMax: 20, moistureMin: 0.3, frostSensitive: true },
  'betula pendula': { tempMin: 3, tempMax: 25, moistureMin: 0.15, frostSensitive: false },
  'fraxinus excelsior': { tempMin: 5, tempMax: 24, moistureMin: 0.25, frostSensitive: true },
  'carpinus betulus': { tempMin: 5, tempMax: 22, moistureMin: 0.25, frostSensitive: true },
  'sorbus aucuparia': { tempMin: 3, tempMax: 22, moistureMin: 0.2, frostSensitive: false },
  'aesculus hippocastanum': { tempMin: 5, tempMax: 22, moistureMin: 0.25, frostSensitive: true },
  'populus nigra': { tempMin: 5, tempMax: 28, moistureMin: 0.3, frostSensitive: false },
  'platanus hispanica': { tempMin: 8, tempMax: 28, moistureMin: 0.2, frostSensitive: true },
  'pinus sylvestris': { tempMin: 0, tempMax: 25, moistureMin: 0.15, frostSensitive: false },
  'picea abies': { tempMin: 0, tempMax: 22, moistureMin: 0.2, frostSensitive: false },
  'malus domestica': { tempMin: 5, tempMax: 22, moistureMin: 0.25, frostSensitive: true },
  'pyrus communis': { tempMin: 5, tempMax: 22, moistureMin: 0.25, frostSensitive: true },
};

const DEFAULT_SPECIES_CONDITIONS = { tempMin: 5, tempMax: 25, moistureMin: 0.2, frostSensitive: true };

function getSpeciesConditions(species: string) {
  const normalized = species.toLowerCase().trim();
  return SPECIES_CONDITIONS[normalized] || DEFAULT_SPECIES_CONDITIONS;
}

const toolHandlers: Record<ToolName, (args: any) => Promise<any>> = {
  async createEvent(args) {
    try {
      console.warn('🔧 [createEvent] CALLED WITH ARGS:', JSON.stringify(args, null, 2));
      console.warn('🔧 [createEvent] args.lat:', args.lat, 'args.lng:', args.lng, 'args.address:', args.address);

      // Default to 'planting' if type not provided by AI
      const eventType = (args.type as EventType) || EventType.PLANTING;
      const defaultLoc = getDefaultLocation();

      const finalLat = args.lat || defaultLoc.lat;
      const finalLng = args.lng || defaultLoc.lng;

      console.warn('🔧 [createEvent] DEFAULT LOC:', defaultLoc);
      console.warn('🔧 [createEvent] FINAL LAT/LNG:', finalLat, finalLng);
      console.warn('🔧 [createEvent] USING DEFAULT?:', !args.lat || !args.lng);

      const event = await createEvent({
        title: args.title,
        type: eventType,
        status: EventStatus.PLANNED,
        start_at: parseISO(args.date),
        lat: finalLat,
        lng: finalLng,
        address: args.address,
        notes: args.notes,
        items: (args.items || []).map((item: any) => ({
          id: crypto.randomUUID(),
          species_name_latin: item.species,
          quantity: item.quantity,
          size_class: item.sizeClass
        }))
      });
      console.warn('✅ [createEvent] SUCCESS:', event.id, 'at lat:', event.lat, 'lng:', event.lng, 'address:', event.address);
      return {
        success: true,
        event: {
          id: event.id,
          title: event.title,
          date: format(event.start_at, 'd.M.yyyy'),
          type: event.type,
          lat: event.lat,
          lng: event.lng,
          address: event.address
        },
        message: `Akce "${event.title}" byla vytvořena na ${format(event.start_at, 'd.M.yyyy')} na lokaci ${event.address || `${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}`}`
      };
    } catch (error) {
      console.error('❌ [createEvent] ERROR:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        message: `Nepodařilo se vytvořit akci: ${errorMessage}`
      };
    }
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
      const id = args.eventId ?? args.id;
      if (!id) {
        return {
          success: false,
          message: 'Chyb? ID akce ke smaz?n?.'
        };
      }
      await deleteEventFn(id);
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
    const defaultLoc = getDefaultLocation();
    const lat = args.lat || defaultLoc.lat;
    const lng = args.lng || defaultLoc.lng;
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
    try {
      const defaultLoc = getDefaultLocation();
      const [events, alerts, forecast] = await Promise.all([
        fetchEvents(),
        fetchAlerts(),
        fetchWeatherForecast(defaultLoc.lat, defaultLoc.lng, 14)
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
    } catch (error) {
      console.error('[ChatService] analyzeRisks error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'Nepodařilo se analyzovat rizika. Zkuste to znovu.'
      };
    }
  },

  async suggestPlantingDate(args) {
    const defaultLoc = getDefaultLocation();
    const forecast = await fetchWeatherForecast(
      args.lat || defaultLoc.lat,
      args.lng || defaultLoc.lng,
      14
    );

    const conditions = getSpeciesConditions(args.species);

    const suitable = forecast.filter(f =>
      f.temperatureMin > conditions.tempMin &&
      f.temperatureMax < conditions.tempMax &&
      f.precipitation < 5 &&
      f.soilMoisture0to1cm > conditions.moistureMin &&
      (!conditions.frostSensitive || f.temperatureMin > 2)
    );

    if (suitable.length === 0) {
      return {
        species: args.species,
        suggestion: `V následujících 14 dnech nejsou ideální podmínky pro ${args.species}.`,
        alternatives: forecast.slice(0, 3).map(f => ({
          date: format(f.date, 'd.M.yyyy'),
          conditions: `${f.temperatureMin.toFixed(0)}-${f.temperatureMax.toFixed(0)}°C, srážky ${f.precipitation.toFixed(0)}mm`
        })),
        speciesRequirements: {
          tempRange: `${conditions.tempMin}-${conditions.tempMax}°C`,
          minMoisture: `${(conditions.moistureMin * 100).toFixed(0)}%`,
          frostSensitive: conditions.frostSensitive
        }
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
      speciesRequirements: {
        tempRange: `${conditions.tempMin}-${conditions.tempMax}°C`,
        minMoisture: `${(conditions.moistureMin * 100).toFixed(0)}%`,
        frostSensitive: conditions.frostSensitive
      },
      reason: `Optimální podmínky pro ${args.species}`
    };
  },

  async getMapContext(_args) {
    console.warn('🗺️ [getMapContext] CALLED');
    const context = globalMapContext.getContext();
    console.warn('🗺️ [getMapContext] RAW CONTEXT:', JSON.stringify(context, null, 2));
    const bestLocation = globalMapContext.getBestLocation();
    console.warn('🗺️ [getMapContext] BEST LOCATION:', bestLocation);

    if (bestLocation) {
      const result = {
        success: true,
        hasLocation: true,
        location: {
          lat: bestLocation.lat,
          lng: bestLocation.lng,
          source: bestLocation.source
        },
        sourceDescription: bestLocation.source === 'picked'
          ? 'Uživatel vybral lokaci na mapě'
          : bestLocation.source === 'gps'
            ? 'GPS pozice uživatele'
            : 'Střed aktuálního pohledu mapy',
        message: `Dostupná lokace: ${bestLocation.lat.toFixed(5)}, ${bestLocation.lng.toFixed(5)} (${bestLocation.source})`
      };
      console.warn('✅ [getMapContext] RETURNING:', JSON.stringify(result, null, 2));
      return result;
    }

    const noLocationResult = {
      success: true,
      hasLocation: false,
      message: 'Uživatel nemá vybranou lokaci. Zeptej se kde chce akci naplánovat, nebo navrhni použít výchozí lokaci.'
    };
    console.warn('⚠️ [getMapContext] NO LOCATION - RETURNING:', JSON.stringify(noLocationResult, null, 2));
    return noLocationResult;
  }
};

// Execute a tool call
async function executeTool(name: ToolName, args: any): Promise<any> {
  console.warn('\n🚀 ============= TOOL EXECUTION =============');
  console.warn('🚀 [executeTool] TOOL NAME:', name);
  console.warn('🚀 [executeTool] ARGS:', JSON.stringify(args, null, 2));

  const handler = toolHandlers[name];
  if (!handler) {
    console.error('❌ [executeTool] UNKNOWN TOOL:', name);
    throw new Error(`Unknown tool: ${name}`);
  }

  const result = await handler(args);
  console.warn('🚀 [executeTool] RESULT:', JSON.stringify(result, null, 2));
  console.warn('🚀 ============= END TOOL EXECUTION =============\n');
  return result;
}

// ============================================================================
// System Prompt
// ============================================================================

function getSystemPrompt(): string {
  const defaultLoc = getDefaultLocation();
  return `Jsi SilvaPlan AI - inteligentní asistent pro správu výsadby a péči o stromy.

TVOJE SCHOPNOSTI:
- Plánování výsadby stromů a keřů do kalendáře pomocí createEvent
- Správa a editace existujících akcí pomocí editEvent, deleteEvent
- Kontrola počasí pomocí getWeather
- Analýza rizik pro plánované akce pomocí analyzeRisks
- Doporučení optimálního data výsadby pomocí suggestPlantingDate
- Zjištění aktuální lokace uživatele pomocí getMapContext

KRITICKÁ PRAVIDLA PRO LOKACI:
- PŘED vytvořením jakékoliv akce VŽDY nejprve zavolej getMapContext
- Pokud getMapContext vrátí lokaci, POUŽIJ JI v createEvent (lat, lng parametry)
- Pokud getMapContext nevrátí lokaci, ZEPTEJ SE uživatele kde chce akci naplánovat
- NIKDY nevytvářej akci bez ověření lokace přes getMapContext

DŮLEŽITÉ PRAVIDLA PRO PRÁCI S DOKUMENTY:
Když uživatel přiloží dokument (text, tabulka), jeho obsah bude součástí zprávy označený jako "--- Dokument: název ---".
1. Nejprve zavolej getMapContext pro zjištění lokace
2. Pak analyzuj obsah dokumentu a vytvoř akce pomocí createEvent s lokací z getMapContext
3. Pokud lokace není dostupná, zeptej se uživatele

PRAVIDLA PRO VYTVÁŘENÍ AKCÍ:
- Pro createEvent VŽDY uveď: title, date (formát YYYY-MM-DD), type, lat, lng
- Pokud type není jasný, použij "planting" pro výsadbu stromů
- Latinské názvy stromů použij v notes

POSTUP PŘI PLÁNOVÁNÍ VÝSADBY:
1. Zavolej getMapContext - zjisti dostupnou lokaci
2. Pokud lokace existuje, vytvoř akce s touto lokací
3. Pokud lokace neexistuje, zeptej se uživatele nebo nabídni výchozí lokaci

LATINSKÉ NÁZVY BĚŽNÝCH DRUHŮ:
- Dub letní = Quercus robur, Dub zimní = Quercus petraea
- Lípa srdčitá = Tilia cordata, Javor mléč = Acer platanoides
- Buk lesní = Fagus sylvatica, Bříza bělokorá = Betula pendula
- Jasan ztepilý = Fraxinus excelsior, Habr obecný = Carpinus betulus
- Jeřáb ptačí = Sorbus aucuparia, Borovice lesní = Pinus sylvestris
- Smrk ztepilý = Picea abies, Jabloň = Malus domestica
- Hrušeň = Pyrus communis, Jírovec maďal = Aesculus hippocastanum
- Topol černý = Populus nigra, Platan = Platanus hispanica

KONTEXT:
- Aktuální datum: ${format(new Date(), 'd.M.yyyy')}
- Výchozí lokace: ${defaultLoc.name} (${defaultLoc.lat}, ${defaultLoc.lng})

Odpovídej stručně. VŽDY volej getMapContext před createEvent.`;
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
