/**
 * ADV-010: Emotional Intelligence - Inteligência emocional avançada
 * 
 * @version 1.0.0
 * @since 7.9.14
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'whl_emotional_intelligence',
    EMOTION_DECAY_RATE: 0.1, // Por mensagem
    SENTIMENT_WINDOW: 5 // Últimas N mensagens
  };

  const EMOTIONS = {
    joy: { positive: true, intensity: 1, responses: ['😊', 'alegria', 'felicidade'] },
    sadness: { positive: false, intensity: 0.8, responses: ['😢', 'triste', 'chateado'] },
    anger: { positive: false, intensity: 1.2, responses: ['😠', 'raiva', 'irritado'] },
    fear: { positive: false, intensity: 0.9, responses: ['😰', 'preocupado', 'medo'] },
    surprise: { positive: null, intensity: 0.7, responses: ['😮', 'surpreso', 'impressionado'] },
    neutral: { positive: null, intensity: 0, responses: [] }
  };

  const EMPATHY_TEMPLATES = {
    anger: [
      'Entendo sua frustração e vou fazer o possível para resolver.',
      'Sinto muito que isso tenha acontecido. Vamos resolver juntos.',
      'Sua insatisfação é totalmente compreensível. Estou aqui para ajudar.'
    ],
    sadness: [
      'Lamento que você esteja passando por isso.',
      'Entendo como isso pode ser difícil.',
      'Estou aqui para ajudar no que for preciso.'
    ],
    fear: [
      'Não se preocupe, vamos resolver isso passo a passo.',
      'Fique tranquilo(a), estou aqui para ajudar.',
      'Entendo sua preocupação, vamos encontrar uma solução.'
    ],
    joy: [
      'Que ótimo! Fico feliz em ajudar! 😊',
      'Excelente! É muito bom saber disso!',
      'Que bom! Estou aqui para o que precisar.'
    ]
  };

  class EmotionalIntelligence {
    constructor() {
      this.contactEmotions = new Map();
      this.emotionHistory = [];
      this.stats = { analyzed: 0, empathyUsed: 0 };
      this.initialized = false;
    }

    async init() {
      await this._loadData();
      this.initialized = true;
      console.log('[EmotionalIntelligence] Initialized');
    }

    async _loadData() {
      try {
        const data = await this._getStorage(CONFIG.STORAGE_KEY);
        if (data) {
          this.contactEmotions = new Map(Object.entries(data.contactEmotions || {}));
          this.stats = data.stats || this.stats;
        }
      } catch (e) {
        console.warn('[EmotionalIntelligence] Load failed:', e);
      }
    }

    async _saveData() {
      await this._setStorage(CONFIG.STORAGE_KEY, {
        contactEmotions: Object.fromEntries(this.contactEmotions),
        stats: this.stats
      });
    }

    _getStorage(key) {
      return new Promise(r => {
        if (typeof chrome !== 'undefined' && chrome.storage)
          chrome.storage.local.get([key], res => r(res[key]));
        else r(null);
      });
    }

    _setStorage(key, value) {
      return new Promise(r => {
        if (typeof chrome !== 'undefined' && chrome.storage)
          chrome.storage.local.set({ [key]: value }, r);
        else r();
      });
    }

    /**
     * Analisa emoção de uma mensagem
     */
    analyze(message, contactId = null) {
      this.stats.analyzed++;
      
      const analysis = {
        text: message,
        emotions: this._detectEmotions(message),
        sentiment: this._calculateSentiment(message),
        intensity: 0,
        dominant: 'neutral',
        timestamp: Date.now()
      };

      // Encontrar emoção dominante
      let maxScore = 0;
      for (const [emotion, score] of Object.entries(analysis.emotions)) {
        if (score > maxScore) {
          maxScore = score;
          analysis.dominant = emotion;
        }
      }
      analysis.intensity = maxScore;

      // Atualizar histórico do contato
      if (contactId) {
        this._updateContactEmotions(contactId, analysis);
      }

      return analysis;
    }

    _detectEmotions(message) {
      const emotions = { joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0, neutral: 0.3 };
      const msgLower = message.toLowerCase();

      // Padrões de emoção
      const patterns = {
        joy: /(obrigad|ótimo|excelente|perfeito|adorei|top|maravilhos|feliz|alegr|😊|😄|❤|👍)/gi,
        sadness: /(triste|chateado|decepcionad|infeliz|pena|😢|😔|😞)/gi,
        anger: /(raiva|irritad|furi|absurd|inaceitável|péssim|horrível|ridícul|😠|😡|🤬)/gi,
        fear: /(medo|preocupad|ansios|nervos|😰|😨|😱)/gi,
        surprise: /(surpres|impressionad|nossa|caramba|uau|😮|😲|🤯)/gi
      };

      // Intensificadores
      const intensifiers = /(muito|demais|super|extremamente|totalmente)/gi;
      const intensifierCount = (msgLower.match(intensifiers) || []).length;
      const intensifierBonus = intensifierCount * 0.1;

      for (const [emotion, pattern] of Object.entries(patterns)) {
        const matches = msgLower.match(pattern) || [];
        emotions[emotion] = Math.min(1, (matches.length * 0.3) + intensifierBonus);
      }

      // Normalizar
      const total = Object.values(emotions).reduce((a, b) => a + b, 0);
      if (total > 0) {
        for (const emotion of Object.keys(emotions)) {
          emotions[emotion] = emotions[emotion] / total;
        }
      }

      return emotions;
    }

    _calculateSentiment(message) {
      const positive = /(obrigad|ótimo|excelente|perfeito|adorei|top|maravilhos|bom|legal|show)/gi;
      const negative = /(problema|erro|péssim|horrível|ridícul|absurd|raiva|frustrad|decepcion)/gi;

      const posMatches = (message.match(positive) || []).length;
      const negMatches = (message.match(negative) || []).length;

      if (posMatches === 0 && negMatches === 0) return 0;
      return (posMatches - negMatches) / (posMatches + negMatches);
    }

    _updateContactEmotions(contactId, analysis) {
      let history = this.contactEmotions.get(contactId) || [];
      history.push(analysis);

      // Manter apenas últimas N
      if (history.length > CONFIG.SENTIMENT_WINDOW * 2) {
        history = history.slice(-CONFIG.SENTIMENT_WINDOW);
      }

      this.contactEmotions.set(contactId, history);
      this._saveData();
    }

    /**
     * Obtém tendência emocional de um contato
     */
    getEmotionalTrend(contactId) {
      const history = this.contactEmotions.get(contactId);
      if (!history || history.length < 2) {
        return { trend: 'neutral', confidence: 0 };
      }

      const recent = history.slice(-CONFIG.SENTIMENT_WINDOW);
      const avgSentiment = recent.reduce((s, a) => s + a.sentiment, 0) / recent.length;

      // Calcular tendência
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));

      const firstAvg = firstHalf.reduce((s, a) => s + a.sentiment, 0) / (firstHalf.length || 1);
      const secondAvg = secondHalf.reduce((s, a) => s + a.sentiment, 0) / (secondHalf.length || 1);

      let trend = 'stable';
      if (secondAvg - firstAvg > 0.2) trend = 'improving';
      else if (firstAvg - secondAvg > 0.2) trend = 'declining';

      return {
        trend,
        avgSentiment,
        dominantEmotion: this._getDominantEmotion(recent),
        recentHistory: recent.map(a => ({
          emotion: a.dominant,
          sentiment: a.sentiment,
          timestamp: a.timestamp
        }))
      };
    }

    _getDominantEmotion(history) {
      const counts = {};
      for (const item of history) {
        counts[item.dominant] = (counts[item.dominant] || 0) + 1;
      }
      
      let dominant = 'neutral';
      let maxCount = 0;
      for (const [emotion, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          dominant = emotion;
        }
      }
      return dominant;
    }

    /**
     * Gera resposta empática
     */
    generateEmpathyResponse(emotion) {
      this.stats.empathyUsed++;
      
      const templates = EMPATHY_TEMPLATES[emotion] || EMPATHY_TEMPLATES.neutral || [
        'Entendo. Como posso ajudar?'
      ];
      
      return templates[Math.floor(Math.random() * templates.length)];
    }

    /**
     * Sugere ajuste de tom
     */
    suggestToneAdjustment(contactId) {
      const trend = this.getEmotionalTrend(contactId);
      const suggestions = [];

      if (trend.dominantEmotion === 'anger') {
        suggestions.push({
          type: 'empathy',
          message: 'Cliente demonstra frustração. Use tom empático.',
          template: this.generateEmpathyResponse('anger')
        });
      }

      if (trend.dominantEmotion === 'sadness') {
        suggestions.push({
          type: 'support',
          message: 'Cliente parece desanimado. Ofereça suporte.',
          template: this.generateEmpathyResponse('sadness')
        });
      }

      if (trend.trend === 'declining') {
        suggestions.push({
          type: 'attention',
          message: 'Sentimento do cliente está piorando. Atenção extra necessária.',
          priority: 'high'
        });
      }

      if (trend.dominantEmotion === 'joy') {
        suggestions.push({
          type: 'match_energy',
          message: 'Cliente está positivo. Mantenha a energia!',
          template: this.generateEmpathyResponse('joy')
        });
      }

      return {
        trend,
        suggestions
      };
    }

    getStats() {
      return {
        ...this.stats,
        trackedContacts: this.contactEmotions.size
      };
    }
  }

  const emotionalIntelligence = new EmotionalIntelligence();
  emotionalIntelligence.init();

  window.WHLEmotionalIntelligence = emotionalIntelligence;
  window.WHLEmotions = EMOTIONS;
  console.log('[ADV-010] Emotional Intelligence initialized');

})();
