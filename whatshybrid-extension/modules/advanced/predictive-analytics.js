/**
 * ADV-004: Predictive Analytics - Análise preditiva de conversas
 * 
 * @version 1.0.0
 * @since 7.9.14
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'whl_predictive',
    PREDICTION_WINDOW_DAYS: 30,
    MIN_DATA_POINTS: 10
  };

  class PredictiveAnalytics {
    constructor() {
      this.conversationData = [];
      this.patterns = new Map(); // SECURITY FIX: Use Map to prevent prototype pollution
      this.models = {};
      this.initialized = false;
      this.errorLog = []; // SECURITY FIX P2-9: Internal error logging
    }

    // ============================================
    // SECURITY HELPERS
    // ============================================

    /**
     * Generate cryptographically secure ID
     * SECURITY FIX P2-8: Replaces predictable Date.now()
     */
    _generateSecureId() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('');
      }
      return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validate category input
     * SECURITY FIX P0-2: Input validation
     */
    _validateCategory(cat) {
      const validCategories = ['sales', 'support', 'billing', 'inquiry', 'complaint', 'other'];
      return validCategories.includes(cat) ? cat : 'other';
    }

    /**
     * Validate sentiment score
     * SECURITY FIX P0-2: Input validation
     */
    _validateSentiment(sentiment) {
      const score = parseFloat(sentiment);
      if (isNaN(score)) return 0;
      return Math.max(-1, Math.min(1, score));
    }

    /**
     * Validate outcome
     * SECURITY FIX P0-2: Input validation
     */
    _validateOutcome(outcome) {
      const validOutcomes = ['sale', 'support_resolved', 'abandoned', 'pending', 'escalated', 'other'];
      return validOutcomes.includes(outcome) ? outcome : 'other';
    }

    /**
     * Sanitize key to prevent prototype pollution
     * SECURITY FIX P0-1: Prevent __proto__, constructor, prototype keys
     */
    _sanitizeKey(key) {
      const str = String(key).replace(/[^a-z0-9_]/gi, '');
      const dangerous = ['__proto__', 'constructor', 'prototype'];
      if (dangerous.includes(str.toLowerCase())) {
        return 'sanitized_key';
      }
      return str;
    }

    /**
     * Log errors internally without console exposure
     * SECURITY FIX P2-9: Information disclosure prevention
     */
    _logError(msg, details = null) {
      this.errorLog.push({
        msg,
        details: details ? String(details).substring(0, 100) : null,
        time: Date.now()
      });
      // Keep only last 50 errors
      if (this.errorLog.length > 50) {
        this.errorLog = this.errorLog.slice(-50);
      }
    }

    /**
     * Hash contact ID for privacy
     * SECURITY FIX P1-4: Data privacy
     */
    _hashContactId(contactId) {
      // Simple hash for privacy (not cryptographic, just obfuscation)
      const str = String(contactId);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `hashed_${Math.abs(hash).toString(36)}`;
    }

    async init() {
      await this._loadData();
      this._trainModels();
      this.initialized = true;
      // SECURITY FIX P2-9: Remove console log in production
      if (typeof DEBUG !== 'undefined' && DEBUG) {
        console.log('[Predictive] Initialized');
      }
    }

    async _loadData() {
      try {
        const data = await this._getStorage(CONFIG.STORAGE_KEY);
        if (data) {
          // SECURITY FIX P1-5: Validate data types before assignment
          this.conversationData = Array.isArray(data.conversationData) ? data.conversationData : [];

          // SECURITY FIX: Convert object to Map to prevent prototype pollution
          if (data.patterns && typeof data.patterns === 'object') {
            this.patterns = new Map(Object.entries(data.patterns));
          } else {
            this.patterns = new Map();
          }
        }
      } catch (e) {
        // SECURITY FIX P1-5 & P2-9: Don't expose error details to console
        this._logError('Failed to load data', e.message);
        this.conversationData = [];
        this.patterns = new Map();
      }
    }

    async _saveData() {
      // SECURITY FIX P1-4: Sanitize data before storage
      const sanitizedData = this.conversationData.slice(-5000).map(d => ({
        ...d,
        contactId: this._hashContactId(d.contactId) // Hash contact IDs for privacy
      }));

      // Convert Map to object for storage
      const patternsObj = Object.fromEntries(this.patterns);

      await this._setStorage(CONFIG.STORAGE_KEY, {
        conversationData: sanitizedData,
        patterns: patternsObj,
        version: 2,
        savedAt: Date.now()
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
     * Registra dados de uma conversa
     * SECURITY FIX P0-2: Input validation
     */
    recordConversation(data) {
      // SECURITY FIX P0-2: Validate input data
      if (!data || typeof data !== 'object') {
        this._logError('Invalid data for recordConversation');
        throw new Error('Invalid conversation data');
      }

      const record = {
        id: `conv_${this._generateSecureId()}`, // SECURITY FIX P2-8: Use secure ID
        timestamp: Date.now(),
        contactId: String(data.contactId || '').substring(0, 100), // SECURITY FIX: Limit length
        category: this._validateCategory(data.category), // SECURITY FIX P0-2: Validate
        sentiment: this._validateSentiment(data.sentiment), // SECURITY FIX P0-2: Validate
        duration: Math.max(0, parseInt(data.duration) || 0), // SECURITY FIX: Validate number
        messageCount: Math.max(0, parseInt(data.messageCount) || 0), // SECURITY FIX: Validate number
        resolved: Boolean(data.resolved), // SECURITY FIX: Ensure boolean
        outcome: this._validateOutcome(data.outcome), // SECURITY FIX P0-2: Validate
        dayOfWeek: new Date().getDay(),
        hourOfDay: new Date().getHours()
      };

      this.conversationData.push(record);
      this._updatePatterns(record);
      this._saveData();
    }

    _updatePatterns(record) {
      // SECURITY FIX P0-1: Use Map instead of object to prevent prototype pollution
      // Padrões por hora do dia
      const hourKey = `hour_${record.hourOfDay}`;
      if (!this.patterns.has(hourKey)) {
        this.patterns.set(hourKey, { count: 0, outcomes: {} });
      }
      const hourPattern = this.patterns.get(hourKey);
      hourPattern.count++;
      hourPattern.outcomes[record.outcome] =
        (hourPattern.outcomes[record.outcome] || 0) + 1;

      // Padrões por dia da semana
      const dayKey = `day_${record.dayOfWeek}`;
      if (!this.patterns.has(dayKey)) {
        this.patterns.set(dayKey, { count: 0, avgDuration: 0 });
      }
      const dayPattern = this.patterns.get(dayKey);
      dayPattern.count++;
      dayPattern.avgDuration =
        (dayPattern.avgDuration * (dayPattern.count - 1) + record.duration) /
        dayPattern.count;

      // Padrões por categoria (with sanitization)
      const catKey = `cat_${this._sanitizeKey(record.category)}`; // SECURITY FIX P0-1
      if (!this.patterns.has(catKey)) {
        this.patterns.set(catKey, { count: 0, avgSentiment: 0, resolutionRate: 0 });
      }
      const catPattern = this.patterns.get(catKey);
      catPattern.count++;
      catPattern.avgSentiment =
        (catPattern.avgSentiment * (catPattern.count - 1) + record.sentiment) /
        catPattern.count;
      if (record.resolved) {
        catPattern.resolutionRate =
          (catPattern.resolutionRate * (catPattern.count - 1) + 1) /
          catPattern.count;
      }
    }

    _trainModels() {
      if (this.conversationData.length < CONFIG.MIN_DATA_POINTS) return;

      // Modelo simples de probabilidade de conversão
      const outcomes = {};
      let total = 0;

      for (const conv of this.conversationData) {
        outcomes[conv.outcome] = (outcomes[conv.outcome] || 0) + 1;
        total++;
      }

      this.models.outcomeProb = {};
      for (const [outcome, count] of Object.entries(outcomes)) {
        this.models.outcomeProb[outcome] = count / total;
      }

      // Modelo de duração esperada
      const durations = this.conversationData.map(c => c.duration).filter(Boolean);
      if (durations.length > 0) {
        this.models.avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        this.models.stdDuration = Math.sqrt(
          durations.reduce((sum, d) => sum + Math.pow(d - this.models.avgDuration, 2), 0) / durations.length
        );
      }
    }

    /**
     * Prediz o resultado provável de uma conversa
     */
    predictOutcome(context) {
      // SECURITY FIX P0-3: Validate and sanitize input context
      if (!context || typeof context !== 'object') {
        throw new Error('Invalid context');
      }

      // Validate and sanitize all inputs
      const category = this._validateCategory(context.category);
      const sentiment = this._validateSentiment(context.sentiment);
      const messageCount = Math.max(0, parseInt(context.messageCount) || 0);
      const hourOfDay = Math.max(0, Math.min(23, parseInt(context.hourOfDay) || 0));
      const dayOfWeek = Math.max(0, Math.min(6, parseInt(context.dayOfWeek) || 0));

      const predictions = {};

      // Base probabilities
      for (const [outcome, prob] of Object.entries(this.models.outcomeProb || {})) {
        predictions[outcome] = prob;
      }

      // Ajustar por hora do dia (using Map with sanitized key)
      const hourKey = `hour_${hourOfDay}`;
      const hourPattern = this.patterns.get(hourKey); // SECURITY FIX: Use Map.get()
      if (hourPattern) {
        for (const [outcome, count] of Object.entries(hourPattern.outcomes)) {
          const hourProb = count / hourPattern.count;
          predictions[outcome] = (predictions[outcome] || 0) * 0.7 + hourProb * 0.3;
        }
      }

      // Ajustar por categoria (using Map with sanitized key)
      const catKey = `cat_${this._sanitizeKey(category)}`; // SECURITY FIX P0-1
      const catPattern = this.patterns.get(catKey); // SECURITY FIX: Use Map.get()
      if (catPattern) {
        if (sentiment < -0.3) {
          predictions['abandoned'] = (predictions['abandoned'] || 0) + 0.2;
        }
        if (catPattern.resolutionRate > 0.8) {
          predictions['support_resolved'] = (predictions['support_resolved'] || 0) + 0.1;
        }
      }

      // SECURITY FIX P2-11: Normalize with division-by-zero protection
      const total = Object.values(predictions).reduce((a, b) => a + b, 0);

      if (total === 0) {
        // Assign uniform distribution if no predictions
        const numOutcomes = Object.keys(predictions).length || 1;
        for (const outcome of Object.keys(predictions)) {
          predictions[outcome] = 1 / numOutcomes;
        }
      } else {
        for (const outcome of Object.keys(predictions)) {
          predictions[outcome] = predictions[outcome] / total;
        }
      }

      // Encontrar mais provável
      const entries = Object.entries(predictions);
      if (entries.length === 0) {
        return {
          predictions: {},
          mostLikely: { outcome: 'unknown', probability: 0 },
          confidence: 0
        };
      }

      const mostLikely = entries.sort((a, b) => b[1] - a[1])[0];

      return {
        predictions,
        mostLikely: { outcome: mostLikely[0], probability: mostLikely[1] },
        confidence: mostLikely[1]
      };
    }

    /**
     * Prediz volume de conversas
     * SECURITY FIX P2-10: Input validation
     */
    predictVolume(dayOfWeek, hourOfDay) {
      // SECURITY FIX P2-10: Validate inputs with bounds checking
      dayOfWeek = Math.max(0, Math.min(6, parseInt(dayOfWeek) || 0));
      hourOfDay = Math.max(0, Math.min(23, parseInt(hourOfDay) || 0));

      // Use Map.get() instead of bracket notation
      const hourPattern = this.patterns.get(`hour_${hourOfDay}`);
      const dayPattern = this.patterns.get(`day_${dayOfWeek}`);

      if (!hourPattern || !dayPattern) {
        return {
          expectedVolume: 0,
          peakHour: 0,
          peakDay: 'Unknown'
        };
      }

      const hourAvg = hourPattern?.count / 7 || 0;
      const dayAvg = dayPattern?.count / 24 || 0;

      return {
        expectedVolume: Math.round((hourAvg + dayAvg) / 2),
        peakHour: this._findPeakHour(),
        peakDay: this._findPeakDay()
      };
    }

    _findPeakHour() {
      let peak = { hour: 0, count: 0 };
      for (let h = 0; h < 24; h++) {
        const pattern = this.patterns[`hour_${h}`];
        if (pattern && pattern.count > peak.count) {
          peak = { hour: h, count: pattern.count };
        }
      }
      return peak.hour;
    }

    _findPeakDay() {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      let peak = { day: 0, count: 0 };
      for (let d = 0; d < 7; d++) {
        const pattern = this.patterns[`day_${d}`];
        if (pattern && pattern.count > peak.count) {
          peak = { day: d, count: pattern.count };
        }
      }
      return days[peak.day];
    }

    /**
     * Identifica tendências
     */
    getTrends() {
      const recent = this.conversationData.slice(-100);
      const older = this.conversationData.slice(-200, -100);

      if (recent.length < 10 || older.length < 10) {
        return { message: 'Dados insuficientes para análise de tendências' };
      }

      const recentAvgSentiment = recent.reduce((s, c) => s + (c.sentiment || 0), 0) / recent.length;
      const olderAvgSentiment = older.reduce((s, c) => s + (c.sentiment || 0), 0) / older.length;

      const recentResolution = recent.filter(c => c.resolved).length / recent.length;
      const olderResolution = older.filter(c => c.resolved).length / older.length;

      return {
        sentiment: {
          current: recentAvgSentiment.toFixed(2),
          previous: olderAvgSentiment.toFixed(2),
          trend: recentAvgSentiment > olderAvgSentiment ? '📈' : '📉'
        },
        resolution: {
          current: (recentResolution * 100).toFixed(1) + '%',
          previous: (olderResolution * 100).toFixed(1) + '%',
          trend: recentResolution > olderResolution ? '📈' : '📉'
        }
      };
    }

    getStats() {
      return {
        totalDataPoints: this.conversationData.length,
        patterns: this.patterns.size, // SECURITY FIX: Use Map.size instead of Object.keys
        hasModel: Object.keys(this.models).length > 0,
        trends: this.getTrends()
      };
    }

    /**
     * Export data with access control
     * SECURITY FIX P1-7: Add access control and filtering
     */
    exportData(options = {}) {
      // SECURITY FIX P1-7: Add basic access control
      // In production, this should check user permissions
      const canExportSensitive = options.includeSensitive === true && this._validateExportAccess();

      return {
        stats: this.getStats(),
        // SECURITY FIX P1-7: Only export patterns if explicitly authorized
        patterns: canExportSensitive ? Object.fromEntries(this.patterns) : {},
        hasData: this.conversationData.length > 0,
        exportedAt: new Date().toISOString(),
        // Never export raw conversationData without explicit filtering
        // conversationData: ... REMOVED FOR SECURITY
      };
    }

    /**
     * Validate export access (placeholder for real auth)
     * SECURITY FIX P1-7: Access control
     */
    _validateExportAccess() {
      // In production, this should check actual user permissions
      // For now, return false by default (deny access to sensitive data)
      return false;
    }
  }

  const predictive = new PredictiveAnalytics();
  predictive.init();

  // SECURITY FIX P1-6: Expose only safe public API, not entire object
  // Use Object.freeze to prevent modification
  window.WHLPredictive = Object.freeze({
    // Safe read-only methods
    getStats: () => predictive.getStats(),
    getTrends: () => predictive.getTrends(),
    predictVolume: (day, hour) => predictive.predictVolume(day, hour),
    predictOutcome: (context) => predictive.predictOutcome(context),

    // DO NOT expose:
    // - recordConversation (prevents data injection)
    // - exportData (prevents data exfiltration)
    // - Internal data (conversationData, patterns, models)
    // - _private methods
  });

  // SECURITY FIX P2-9: Remove debug console log in production
  if (typeof DEBUG !== 'undefined' && DEBUG) {
    console.log('[ADV-004] Predictive Analytics initialized');
  }

})();
