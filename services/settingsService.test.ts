// services/settingsService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getSettings,
    saveSettings,
    validateApiKey,
    isConfigured,
    resolveEnvApiKeys,
    getActiveModelId,
    updateModelId,
    type AISettings,
} from './settingsService';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        clear: () => { store = {}; },
        removeItem: (key: string) => { delete store[key]; },
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('settingsService', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('getSettings', () => {
        it('returns default settings when localStorage is empty', () => {
            const settings = getSettings();

            expect(settings.provider).toBe('openrouter');
            expect(settings.openrouterApiKey).toBe('');
            expect(settings.geminiApiKey).toBe('');
        });

        it('uses VITE_ env keys when provided', () => {
            const resolved = resolveEnvApiKeys({
                MODE: 'development',
                VITE_OPENROUTER_API_KEY: 'sk-or-v1-test',
                VITE_GEMINI_API_KEY: 'AIzaSyTestKeyFromVite',
            } as any);

            expect(resolved.openrouterApiKey).toBe('sk-or-v1-test');
            expect(resolved.geminiApiKey).toBe('AIzaSyTestKeyFromVite');
        });

        it('returns stored settings from localStorage', () => {
            const stored: AISettings = {
                provider: 'gemini',
                openrouterApiKey: 'sk-or-v1-test',
                geminiApiKey: 'AIzaSyTest123',
                openrouterModelId: 'google/gemini-2.5-flash',
                geminiModelId: 'gemini-2.5-flash',
                streamResponses: false,
                maxHistoryMessages: 50,
                defaultLat: 50.0755,
                defaultLng: 14.4378,
                defaultLocationName: 'Praha'
            };
            localStorageMock.setItem('silvaplan_ai_settings', JSON.stringify(stored));

            const settings = getSettings();

            expect(settings.provider).toBe('gemini');
            expect(settings.geminiApiKey).toBe('AIzaSyTest123');
        });
    });

    describe('validateApiKey', () => {
        it('rejects empty API key', () => {
            const result = validateApiKey('openrouter', '');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('prázdný');
        });

        it('validates OpenRouter key format', () => {
            const validResult = validateApiKey('openrouter', 'sk-or-v1-abcdefghijklmnopqrstuvwxyz');
            expect(validResult.valid).toBe(true);

            const invalidResult = validateApiKey('openrouter', 'invalid-key');
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.error).toContain('sk-or-v1-');
        });

        it('validates Gemini key format', () => {
            const validResult = validateApiKey('gemini', 'AIzaSyTestKeyWithEnoughCharacters123');
            expect(validResult.valid).toBe(true);

            const invalidResult = validateApiKey('gemini', 'invalid-key');
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.error).toContain('AIzaSy');
        });
    });

    describe('isConfigured', () => {
        it('returns false when no API key is set', () => {
            expect(isConfigured()).toBe(false);
        });

        it('returns true when OpenRouter key is set', () => {
            const settings: AISettings = {
                provider: 'openrouter',
                openrouterApiKey: 'sk-or-v1-testkey123456789',
                geminiApiKey: '',
                openrouterModelId: 'google/gemini-2.5-flash',
                geminiModelId: 'gemini-2.5-flash',
                streamResponses: false,
                maxHistoryMessages: 50,
                defaultLat: 50.0755,
                defaultLng: 14.4378,
                defaultLocationName: 'Praha'
            };
            saveSettings(settings);

            expect(isConfigured()).toBe(true);
        });
    });

    describe('model selection helpers', () => {
        it('returns active model id based on provider', () => {
            const settings: AISettings = {
                provider: 'gemini',
                openrouterApiKey: '',
                geminiApiKey: '',
                openrouterModelId: 'openrouter-model',
                geminiModelId: 'gemini-model',
                streamResponses: false,
                maxHistoryMessages: 50,
                defaultLat: 50.0755,
                defaultLng: 14.4378,
                defaultLocationName: 'Praha'
            };

            expect(getActiveModelId(settings)).toBe('gemini-model');

            settings.provider = 'openrouter';
            expect(getActiveModelId(settings)).toBe('openrouter-model');
        });

        it('updates the correct model id field', () => {
            const settings: AISettings = {
                provider: 'gemini',
                openrouterApiKey: '',
                geminiApiKey: '',
                openrouterModelId: 'openrouter-model',
                geminiModelId: 'gemini-model',
                streamResponses: false,
                maxHistoryMessages: 50,
                defaultLat: 50.0755,
                defaultLng: 14.4378,
                defaultLocationName: 'Praha'
            };

            const updatedGemini = updateModelId(settings, 'gemini-new');
            expect(updatedGemini.geminiModelId).toBe('gemini-new');
            expect(updatedGemini.openrouterModelId).toBe('openrouter-model');

            const updatedOpenRouter = updateModelId({ ...settings, provider: 'openrouter' }, 'openrouter-new');
            expect(updatedOpenRouter.openrouterModelId).toBe('openrouter-new');
            expect(updatedOpenRouter.geminiModelId).toBe('gemini-model');
        });
    });
});
