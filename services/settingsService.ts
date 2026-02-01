/**
 * Settings Service for SilvaPlan AI Assistant
 * Handles API key storage, model selection, and preferences in localStorage
 */

import type { AIProvider } from './ai/types';

// Re-export for consumers
export type { AIProvider };

// ============================================================================
// Types
// ============================================================================

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: number;
    completion: number;
  };
}

export interface AISettings {
  // Provider selection
  provider: AIProvider;

  // API Keys
  openrouterApiKey: string;
  geminiApiKey: string;

  // Model selection
  openrouterModelId: string;
  geminiModelId: string;

  // User preferences
  streamResponses: boolean;
  maxHistoryMessages: number;

  // Default location
  defaultLat: number;
  defaultLng: number;
  defaultLocationName: string;
}

export interface GeminiModelInfo {
  id: string;
  name: string;
  description: string;
  apiUrl: string;
}

// ============================================================================
// Constants
// ============================================================================

const SETTINGS_KEY = 'silvaplan_ai_settings';
const MODELS_CACHE_KEY = 'silvaplan_openrouter_models';
const MODELS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_SETTINGS: AISettings = {
  provider: 'openrouter',
  openrouterApiKey: '',
  geminiApiKey: '',
  openrouterModelId: 'google/gemini-3-flash-preview',
  geminiModelId: 'gemini-2.5-flash',
  streamResponses: false,
  maxHistoryMessages: 50,
  defaultLat: 50.0755,
  defaultLng: 14.4378,
  defaultLocationName: 'Praha',
};

// Gemini 2.5 Flash is the stable model (Gemini 2.0 Flash is deprecated March 2026)
export const GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Stabilní model s nejlepším poměrem cena/výkon',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  },
  {
    id: 'gemini-2.0-flash-thinking-exp',
    name: 'Gemini 2.0 Flash Thinking (Experimental)',
    description: 'Experimentální model s viditelným myšlenkovým procesem',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp:generateContent'
  }
];

// Recommended OpenRouter models for SilvaPlan (support tool calling)
export const RECOMMENDED_OPENROUTER_MODELS: OpenRouterModel[] = [
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    description: 'Nejnovější model s 1M kontextem a thinking capabilities',
    context_length: 1048576,
    pricing: { prompt: 0.0000005, completion: 0.000003 }
  },
  {
    id: 'google/gemini-2.5-flash-preview',
    name: 'Gemini 2.5 Flash Preview',
    description: 'Stabilní preview model s výborným poměrem cena/výkon',
    context_length: 1048576,
    pricing: { prompt: 0.0000005, completion: 0.000003 }
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    description: 'Nejlepší model pro složité reasoning úkoly',
    context_length: 200000,
    pricing: { prompt: 0.000005, completion: 0.000025 }
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Vyvážený model s dobrou kvalitou za rozumnou cenu',
    context_length: 200000,
    pricing: { prompt: 0.000003, completion: 0.000015 }
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Rychlý a levný model od OpenAI',
    context_length: 128000,
    pricing: { prompt: 0.00000015, completion: 0.0000006 }
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct:free',
    name: 'Llama 3.1 70B (Free)',
    description: 'Bezplatný open-source model',
    context_length: 131072,
    pricing: { prompt: 0, completion: 0 }
  }
];

// ============================================================================
// Settings Management
// ============================================================================

/**
 * Get settings from localStorage
 */
export function getSettings(): AISettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AISettings>;
      return {
        provider: parsed.provider ?? DEFAULT_SETTINGS.provider,
        openrouterApiKey: parsed.openrouterApiKey ?? '',
        geminiApiKey: parsed.geminiApiKey ?? '',
        openrouterModelId: parsed.openrouterModelId ?? DEFAULT_SETTINGS.openrouterModelId,
        geminiModelId: parsed.geminiModelId ?? DEFAULT_SETTINGS.geminiModelId,
        streamResponses: parsed.streamResponses ?? DEFAULT_SETTINGS.streamResponses,
        maxHistoryMessages: parsed.maxHistoryMessages ?? DEFAULT_SETTINGS.maxHistoryMessages,
        defaultLat: parsed.defaultLat ?? DEFAULT_SETTINGS.defaultLat,
        defaultLng: parsed.defaultLng ?? DEFAULT_SETTINGS.defaultLng,
        defaultLocationName: parsed.defaultLocationName ?? DEFAULT_SETTINGS.defaultLocationName,
      };
    }
  } catch (error) {
    console.error('[SettingsService] Error loading settings:', error);
  }

  return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: AISettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Dispatch custom event for reactive updates
    window.dispatchEvent(new CustomEvent('aisettings-changed', { detail: settings }));
  } catch (error) {
    console.error('[SettingsService] Error saving settings:', error);
  }
}

/**
 * Update specific settings fields
 */
export function updateSettings(updates: Partial<AISettings>): AISettings {
  const current = getSettings();
  const updated = { ...current, ...updates };
  saveSettings(updated);
  return updated;
}

// ============================================================================
// API Key Management
// ============================================================================

/**
 * Get the active API key based on current provider
 */
export function getActiveApiKey(): string | null {
  const settings = getSettings();

  if (settings.provider === 'openrouter') {
    return settings.openrouterApiKey.trim() || null;
  }
  return settings.geminiApiKey.trim() || null;
}

/**
 * Validate API key format
 */
export function validateApiKey(provider: AIProvider, apiKey: string): { valid: boolean; error?: string } {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    return { valid: false, error: 'API klíč nesmí být prázdný' };
  }

  if (provider === 'openrouter') {
    // OpenRouter keys start with 'sk-or-v1-'
    if (!trimmed.startsWith('sk-or-v1-')) {
      return { valid: false, error: 'OpenRouter klíč musí začínat "sk-or-v1-"' };
    }
    if (trimmed.length < 20) {
      return { valid: false, error: 'API klíč je příliš krátký' };
    }
  } else if (provider === 'gemini') {
    // Gemini keys start with 'AIzaSy'
    if (!trimmed.startsWith('AIzaSy')) {
      return { valid: false, error: 'Gemini klíč musí začínat "AIzaSy"' };
    }
    if (trimmed.length < 35) {
      return { valid: false, error: 'API klíč je příliš krátký' };
    }
  }

  return { valid: true };
}

/**
 * Check if any API key is configured
 */
export function isConfigured(): boolean {
  return getActiveApiKey() !== null;
}

// ============================================================================
// OpenRouter Models API
// ============================================================================

interface ModelsCache {
  timestamp: number;
  models: OpenRouterModel[];
}

/**
 * Fetch available models from OpenRouter API
 * Based on: https://openrouter.ai/docs/api/api-reference/models/get-models
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from OpenRouter');
    }

    // Transform to our format
    const models: OpenRouterModel[] = data.data.map((m: any) => ({
      id: m.id,
      name: m.name,
      description: m.description || '',
      context_length: m.context_length || 0,
      pricing: {
        prompt: parseFloat(m.pricing?.prompt || '0'),
        completion: parseFloat(m.pricing?.completion || '0')
      }
    }));

    // Cache the results
    const cache: ModelsCache = {
      timestamp: Date.now(),
      models
    };
    localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(cache));

    return models;
  } catch (error) {
    console.error('[SettingsService] Error fetching OpenRouter models:', error);
    throw error;
  }
}

/**
 * Get models from cache or fetch fresh data
 */
export async function getOpenRouterModels(): Promise<OpenRouterModel[]> {
  // Try cache first
  const cached = localStorage.getItem(MODELS_CACHE_KEY);
  if (cached) {
    try {
      const cache = JSON.parse(cached) as ModelsCache;
      const age = Date.now() - cache.timestamp;

      if (age < MODELS_CACHE_TTL && cache.models?.length > 0) {
        return cache.models;
      }
    } catch {
      // Cache invalid, ignore
    }
  }

  // Fetch fresh data
  return fetchOpenRouterModels();
}

/**
 * Get filtered list of models suitable for tool calling
 */
export async function getToolCompatibleModels(): Promise<OpenRouterModel[]> {
  const allModels = await getOpenRouterModels();

  // Filter models that support function calling
  // Most modern models do, but we can check for specific patterns
  return allModels.filter(m => {
    // Include all Google models (they support tools)
    if (m.id.startsWith('google/')) return true;
    // Include Claude models (they support tools)
    if (m.id.startsWith('anthropic/claude')) return true;
    // Include OpenAI models
    if (m.id.startsWith('openai/gpt')) return true;
    // Include Llama models
    if (m.id.includes('llama') && m.id.includes('instruct')) return true;

    return false;
  });
}

// ============================================================================
// Provider & Model Selection
// ============================================================================

/**
 * Get current provider and model info
 */
export function getProviderConfig(): {
  provider: AIProvider;
  modelId: string;
  apiKey: string | null;
  geminiApiUrl?: string;
} | null {
  const settings = getSettings();
  const apiKey = getActiveApiKey();

  if (!apiKey) return null;

  if (settings.provider === 'openrouter') {
    return {
      provider: 'openrouter',
      modelId: settings.openrouterModelId,
      apiKey
    };
  } else {
    const geminiModel = GEMINI_MODELS.find(m => m.id === settings.geminiModelId);
    return {
      provider: 'gemini',
      modelId: geminiModel?.id || 'gemini-2.5-flash',
      apiKey,
      geminiApiUrl: geminiModel?.apiUrl
    };
  }
}

// ============================================================================
// Event Listener Helper
// ============================================================================

/**
 * Subscribe to settings changes
 */
export function onSettingsChanged(callback: (settings: AISettings) => void): () => void {
  const handler = (e: CustomEvent<AISettings>) => callback(e.detail);
  window.addEventListener('aisettings-changed', handler as EventListener);
  return () => window.removeEventListener('aisettings-changed', handler as EventListener);
}

/**
 * Get default location settings
 */
export function getDefaultLocation(): { lat: number; lng: number; name: string } {
  const settings = getSettings();
  return {
    lat: settings.defaultLat,
    lng: settings.defaultLng,
    name: settings.defaultLocationName
  };
}
