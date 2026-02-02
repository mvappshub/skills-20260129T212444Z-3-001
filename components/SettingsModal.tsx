// components/SettingsModal.tsx
/**
 * Settings Modal for SilvaPlan AI Assistant
 *
 * Allows users to configure:
 * - API keys for OpenRouter and Gemini
 * - Provider selection
 * - Model selection (with dynamic loading from OpenRouter API)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Settings,
  Key,
  Server,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import {
  getSettings,
  saveSettings,
  updateSettings,
  validateApiKey,
  getOpenRouterModels,
  RECOMMENDED_OPENROUTER_MODELS,
  GEMINI_MODELS,
  getActiveModelId,
  updateModelId,
  type OpenRouterModel,
  type AISettings,
  type AIProvider
} from '../services/settingsService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // Local state for form
  const [settings, setSettings] = useState<AISettings>(getSettings());
  const [showKeys, setShowKeys] = useState({ openrouter: false, gemini: false });
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    openrouter?: { valid: boolean; error?: string };
    gemini?: { valid: boolean; error?: string };
  }>({});

  // Models state
  const [openrouterModels, setOpenrouterModels] = useState<OpenRouterModel[]>(
    RECOMMENDED_OPENROUTER_MODELS
  );
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    setSettings(getSettings());
  }, [isOpen]);

  // Load OpenRouter models when provider is OpenRouter
  useEffect(() => {
    if (settings.provider === 'openrouter' && isOpen) {
      loadOpenRouterModels();
    }
  }, [settings.provider, isOpen]);

  const loadOpenRouterModels = async () => {
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const models = await getOpenRouterModels();
      // Filter to show only models that support function calling
      const filtered = models.filter(m =>
        m.id.startsWith('google/') ||
        m.id.startsWith('anthropic/claude') ||
        m.id.startsWith('openai/gpt') ||
        m.id.includes('llama')
      );
      setOpenrouterModels(filtered);
    } catch (error) {
      console.error('Failed to load OpenRouter models:', error);
      setModelsError('Nepodařilo se načíst seznam modelů. Používám doporučené modely.');
      setOpenrouterModels(RECOMMENDED_OPENROUTER_MODELS);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    window.dispatchEvent(new CustomEvent('aisettings-changed', { detail: settings }));
    onClose();
  };

  const handleCancel = () => {
    setSettings(getSettings()); // Reset to saved
    onClose();
  };

  const handleProviderChange = (provider: AIProvider) => {
    setSettings(prev => ({ ...prev, provider }));
    setValidationResult({});
  };

  const handleApiKeyChange = (provider: AIProvider, value: string) => {
    setSettings(prev => ({
      ...prev,
      [provider === 'openrouter' ? 'openrouterApiKey' : 'geminiApiKey']: value
    }));
    setValidationResult(prev => ({ ...prev, [provider]: undefined }));
  };

  const handleModelChange = (modelId: string) => {
    setSettings(prev => updateModelId(prev, modelId));
  };

  const validateCurrentKey = async (provider: AIProvider) => {
    const apiKey = provider === 'openrouter'
      ? settings.openrouterApiKey
      : settings.geminiApiKey;

    if (!apiKey.trim()) {
      setValidationResult(prev => ({
        ...prev,
        [provider]: { valid: false, error: 'API klíč nesmí být prázdný' }
      }));
      return;
    }

    setIsValidating(true);
    try {
      const result = validateApiKey(provider, apiKey);
      setValidationResult(prev => ({ ...prev, [provider]: result }));
    } catch {
      setValidationResult(prev => ({
        ...prev,
        [provider]: { valid: false, error: 'Neznámá chyba' }
      }));
    } finally {
      setIsValidating(false);
    }
  };

  const toggleKeyVisibility = (provider: AIProvider) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  if (!isOpen) return null;

  const activeProvider = settings.provider;
  const activeApiKey = activeProvider === 'openrouter'
    ? settings.openrouterApiKey
    : settings.geminiApiKey;

  const isConfigured = activeApiKey.trim().length > 0;
  const currentValidation = validationResult[activeProvider];

  // Model selection options
  const activeModelId = getActiveModelId(settings);

  const modelOptions = activeProvider === 'openrouter'
    ? openrouterModels
    : GEMINI_MODELS.map(m => ({ id: m.id, name: m.name, description: m.description }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Nastavení AI asistenta</h2>
              <p className="text-sm text-slate-500">Konfigurace API klíčů a modelů</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            title="Zavřít"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Provider Selection */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
              Poskytovatel AI (Provider)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleProviderChange('openrouter')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  settings.provider === 'openrouter'
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    settings.provider === 'openrouter'
                      ? 'bg-emerald-600'
                      : 'bg-slate-200'
                  }`}>
                    <Server className={`w-5 h-5 ${
                      settings.provider === 'openrouter' ? 'text-white' : 'text-slate-600'
                    }`} />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-slate-800">OpenRouter</div>
                    <div className="text-xs text-slate-500">400+ modelů v jednom API</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleProviderChange('gemini')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  settings.provider === 'gemini'
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    settings.provider === 'gemini'
                      ? 'bg-blue-600'
                      : 'bg-slate-200'
                  }`}>
                    <Key className={`w-5 h-5 ${
                      settings.provider === 'gemini' ? 'text-white' : 'text-slate-600'
                    }`} />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-slate-800">Google Gemini</div>
                    <div className="text-xs text-slate-500">Přímý přístup k Google AI</div>
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* API Key Configuration */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                API Klíče
              </h3>
              {activeProvider === 'openrouter' && (
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  Získat klíč <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {activeProvider === 'gemini' && (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  Získat klíč <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* OpenRouter API Key */}
            <div className={`p-4 rounded-xl border-2 transition-all ${
              settings.provider === 'openrouter'
                ? 'border-emerald-300 bg-emerald-50/50'
                : 'border-slate-200 bg-slate-50'
            }`}>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Key className="w-4 h-4" />
                OpenRouter API Key
                {settings.provider === 'openrouter' && (
                  <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">Aktivní</span>
                )}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKeys.openrouter ? 'text' : 'password'}
                    value={settings.openrouterApiKey}
                    onChange={(e) => handleApiKeyChange('openrouter', e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleKeyVisibility('openrouter')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showKeys.openrouter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => validateCurrentKey('openrouter')}
                  disabled={isValidating}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isValidating && validationResult.openrouter === undefined ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : validationResult.openrouter?.valid ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : validationResult.openrouter?.valid === false ? (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
              {validationResult.openrouter?.error && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {validationResult.openrouter.error}
                </p>
              )}
            </div>

            {/* Gemini API Key */}
            <div className={`p-4 rounded-xl border-2 transition-all ${
              settings.provider === 'gemini'
                ? 'border-blue-300 bg-blue-50/50'
                : 'border-slate-200 bg-slate-50'
            }`}>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Key className="w-4 h-4" />
                Gemini API Key
                {settings.provider === 'gemini' && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Aktivní</span>
                )}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKeys.gemini ? 'text' : 'password'}
                    value={settings.geminiApiKey}
                    onChange={(e) => handleApiKeyChange('gemini', e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleKeyVisibility('gemini')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showKeys.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => validateCurrentKey('gemini')}
                  disabled={isValidating}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isValidating && validationResult.gemini === undefined ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : validationResult.gemini?.valid ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : validationResult.gemini?.valid === false ? (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
              {validationResult.gemini?.error && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {validationResult.gemini.error}
                </p>
              )}
            </div>
          </section>

          {/* Model Selection */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Model
              </h3>
              {activeProvider === 'openrouter' && (
                <button
                  type="button"
                  onClick={loadOpenRouterModels}
                  disabled={isLoadingModels}
                  className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                  Obnovit seznam
                </button>
              )}
            </div>

            {modelsError && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                {modelsError}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {modelOptions.map((model) => (
                <label
                  key={model.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    activeModelId === model.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={activeModelId === model.id}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="mt-1 w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 text-sm truncate">
                      {model.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {model.description}
                    </div>
                  </div>
                  {(model as OpenRouterModel).pricing && (
                    <div className="text-xs text-slate-400 whitespace-nowrap">
                      {((model as OpenRouterModel).pricing.prompt * 1000000).toFixed(2)}$ /
                      {((model as OpenRouterModel).pricing.completion * 1000000).toFixed(2)}$
                    </div>
                  )}
                </label>
              ))}
            </div>
          </section>

          {/* Status Summary */}
          <section className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Stav konfigurace</h4>
            {isConfigured ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span>
                  {activeProvider === 'openrouter' ? 'OpenRouter' : 'Gemini'} je nakonfigurován
                  {currentValidation?.valid && ' a klíč byl ověřen'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <AlertCircle className="w-4 h-4" />
                <span>Nastavte API klíč pro vybraného poskytovatele</span>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 py-2.5 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors font-medium"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isConfigured}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Uložit nastavení
          </button>
        </div>
      </div>
    </div>
  );
}
