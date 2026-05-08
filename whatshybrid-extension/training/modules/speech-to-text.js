/**
 * 🗣️ WhatsHybrid - Speech to Text
 * Transcrição de áudio com múltiplos provedores e idiomas
 * @version 7.9.13
 */
(function() {
  'use strict';

  const LANGUAGES = {
    'pt-BR': { name: 'Português (Brasil)', whisper: 'pt', flag: '🇧🇷' },
    'en-US': { name: 'English (US)', whisper: 'en', flag: '🇺🇸' },
    'es-ES': { name: 'Español', whisper: 'es', flag: '🇪🇸' },
    'fr-FR': { name: 'Français', whisper: 'fr', flag: '🇫🇷' },
    'de-DE': { name: 'Deutsch', whisper: 'de', flag: '🇩🇪' },
    'it-IT': { name: 'Italiano', whisper: 'it', flag: '🇮🇹' },
    'ja-JP': { name: '日本語', whisper: 'ja', flag: '🇯🇵' },
    'zh-CN': { name: '中文', whisper: 'zh', flag: '🇨🇳' },
    'ar-SA': { name: 'العربية', whisper: 'ar', flag: '🇸🇦' },
    'ru-RU': { name: 'Русский', whisper: 'ru', flag: '🇷🇺' },
    'auto': { name: 'Auto-detectar', whisper: null, flag: '🌐' }
  };

  // v9.4.6: PROVIDERS reduzido pra apenas BACKEND. Backend-Only AI desde v9.4.0.
  // OpenAI/Google/Browser eram dead code (exigiam API key do cliente).
  const PROVIDERS = {
    BACKEND: 'backend'  // ÚNICO: usa Whisper do servidor (Backend-Only AI)
  };

  class SpeechToText {
    constructor(options = {}) {
      this.provider = PROVIDERS.BACKEND;  // sempre backend
      this.language = options.language || 'pt-BR';
      this.onProgress = options.onProgress || null;
      this.onError = options.onError || null;
    }

    setLanguage(lang) { if (LANGUAGES[lang]) this.language = lang; }

    async transcribe(audioBlob, options = {}) {
      const lang = options.language || this.language;
      this.onProgress?.({ status: 'processing', message: 'Processando áudio...' });

      try {
        // v9.4.6: provider escolha REMOVIDA. Backend-Only AI: única opção é _backend.
        // Antes: switch entre openai/google/browser/backend. Cada um exigia API key
        // configurada pelo cliente, que viola modelo SaaS Backend-Only.
        const result = await this._backend(audioBlob, lang);
        return result;
      } catch (error) {
        this.onError?.(error);
        throw error;
      }
    }

    async _backend(blob, lang) {
      const url = await this._getBackendUrl();
      const formData = new FormData();
      formData.append('audio', blob, 'audio.webm');
      formData.append('language', lang);

      this.onProgress?.({ status: 'uploading', message: 'Enviando para servidor...' });

      const res = await fetch(`${url}/api/v1/speech/transcribe`, {
        method: 'POST',
        body: formData,
        headers: await this._getAuthHeaders()
      });

      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
      const data = await res.json();
      return { text: data.text || '', language: lang, provider: 'backend', confidence: data.confidence || 0 };
    }

    async _getBackendUrl() {
      // FIX v9.3.0: chrome.storage?.local.get() retorna undefined, não a Promise.
      // Antes: `.get() || resolve(default)` causava resolve duplicado quando
      // chrome.storage existia (a promise resolvia uma vez no callback e outra
      // no operador ||). Resultado: valor sobrescrito por default.
      return new Promise(resolve => {
        const fallback = globalThis.WHL_ENDPOINTS?.BACKEND_DEFAULT || 'http://localhost:3000';
        if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) {
          return resolve(fallback);
        }
        chrome.storage.local.get(['whl_backend_url'], r => {
          resolve(r?.whl_backend_url || fallback);
        });
      });
    }

    async _getAuthHeaders() {
      return new Promise(resolve => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) {
          return resolve({});
        }
        chrome.storage.local.get(['whl_auth_token'], r => {
          resolve(r?.whl_auth_token ? { 'Authorization': `Bearer ${r.whl_auth_token}` } : {});
        });
      });
    }

    static getLanguages() {
      return Object.entries(LANGUAGES).map(([code, info]) => ({ code, ...info }));
    }

    static getProviders() {
      // v9.4.6: única opção é BACKEND (Backend-Only AI)
      return [
        { id: PROVIDERS.BACKEND, name: 'Servidor', desc: 'Transcrição via servidor (incluído no plano)' },
      ];
    }
  }

  window.WHLSpeechToText = SpeechToText;
  window.WHLSTTProviders = PROVIDERS;
  window.WHLSTTLanguages = LANGUAGES;
})();
