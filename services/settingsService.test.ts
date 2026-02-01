// services/settingsService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getSettings,
    saveSettings,
    validateApiKey,
    isConfigured,
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
});
