/**
 * 🧠 SmartBot IA Extended - Sistemas Avançados
 * 
 * Módulo complementar com 9 sistemas adicionais:
 * - DialogManager: Máquina de estados para conversas
 * - EntityManager: Extração de entidades com fuzzy matching
 * - IntentManager: Classificação de intenções
 * - HumanAssistanceSystem: Escalação e gestão de agentes
 * - CacheManager: LRU eviction com TTL
 * - RateLimitManager: Token bucket algorithm
 * - ContextManager: Contexto aninhado com TTL
 * - SessionManager: Lifecycle de sessões
 * - FeedbackAnalyzer: Análise avançada de feedback
 * 
 * @version 1.0.0
 * @author WhatsHybrid Team
 */

(function() {
  'use strict';

  const STORAGE_KEYS = {
    DIALOGS: 'whl_smartbot_dialogs',
    ENTITIES: 'whl_smartbot_entities',
    INTENTS: 'whl_smartbot_intents',
    ESCALATIONS: 'whl_smartbot_escalations',
    CACHE: 'whl_smartbot_cache',
    SESSIONS: 'whl_smartbot_sessions',
    FEEDBACK: 'whl_smartbot_feedback'
  };

  // ============================================================
  // 🛡️ SECURITY HELPERS - Prototype Pollution Protection
  // ============================================================

  /**
   * Remove dangerous keys that can cause prototype pollution
   * @param {object} obj - Object to sanitize
   * @returns {object} - Clean object
   */
  function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return obj;
    }

    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    const clean = Object.create(null);

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (dangerousKeys.includes(key)) {
          console.warn(`[Security] Blocked prototype pollution attempt: ${key}`);
          continue;
        }

        // Recursively sanitize nested objects
        if (obj[key] && typeof obj[key] === 'object') {
          clean[key] = sanitizeObject(obj[key]);
        } else {
          clean[key] = obj[key];
        }
      }
    }

    return clean;
  }

  /**
   * Validates key names to prevent prototype pollution
   * @param {string} key - Key to validate
   * @returns {boolean} - True if safe, false if dangerous
   */
  function isSafeKey(key) {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    const parts = String(key).split('.');

    for (const part of parts) {
      if (dangerousKeys.includes(part)) {
        console.warn(`[Security] Blocked dangerous key: ${key}`);
        return false;
      }
    }

    return true;
  }

  // ============================================================
  // 🎭 DIALOG MANAGER
  // Máquina de estados para gerenciar fluxos de conversa
  // ============================================================
  class DialogManager {
    constructor() {
      this.dialogs = new Map();
      this.activeDialogs = new Map();
      this.transitions = new Map();
      this.hooks = {
        onEnter: new Map(),
        onExit: new Map(),
        onTransition: []
      };
      this.loadDialogs();
    }

    async loadDialogs() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.DIALOGS);
        if (data[STORAGE_KEYS.DIALOGS]) {
          const parsed = JSON.parse(data[STORAGE_KEYS.DIALOGS]);
          Object.entries(parsed.dialogs || {}).forEach(([k, v]) => this.dialogs.set(k, v));
          Object.entries(parsed.activeDialogs || {}).forEach(([k, v]) => this.activeDialogs.set(k, v));
        }
      } catch (e) {
        console.warn('[DialogManager] Erro ao carregar:', e);
      }
    }

    async saveDialogs() {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.DIALOGS]: JSON.stringify({
            dialogs: Object.fromEntries(this.dialogs),
            activeDialogs: Object.fromEntries(this.activeDialogs)
          })
        });
      } catch (e) {
        console.warn('[DialogManager] Erro ao salvar:', e);
      }
    }

    /**
     * Registra um novo fluxo de diálogo
     * @param {string} dialogId - ID único do diálogo
     * @param {Object} config - Configuração do diálogo
     */
    registerDialog(dialogId, config) {
      const dialog = {
        id: dialogId,
        name: config.name || dialogId,
        initialState: config.initialState || 'start',
        states: config.states || {},
        transitions: config.transitions || [],
        timeout: config.timeout || 300000, // 5 min default
        metadata: config.metadata || {},
        createdAt: new Date().toISOString()
      };

      this.dialogs.set(dialogId, dialog);
      
      // Indexa transições para busca rápida
      dialog.transitions.forEach(t => {
        const key = `${dialogId}:${t.from}:${t.trigger}`;
        this.transitions.set(key, t);
      });

      this.saveDialogs();
      return dialog;
    }

    /**
     * Inicia um diálogo para um chat
     */
    startDialog(chatId, dialogId, initialData = {}) {
      const dialog = this.dialogs.get(dialogId);
      if (!dialog) {
        throw new Error(`Diálogo não encontrado: ${dialogId}`);
      }

      const session = {
        chatId,
        dialogId,
        currentState: dialog.initialState,
        data: initialData,
        history: [{
          state: dialog.initialState,
          timestamp: Date.now(),
          action: 'start'
        }],
        startedAt: Date.now(),
        lastActivity: Date.now()
      };

      this.activeDialogs.set(chatId, session);
      
      // Executa hook onEnter do estado inicial
      this._executeHook('onEnter', dialogId, dialog.initialState, session);
      
      this.saveDialogs();
      return session;
    }

    /**
     * Processa input e faz transição de estado
     */
    processInput(chatId, input, context = {}) {
      const session = this.activeDialogs.get(chatId);
      if (!session) {
        return { handled: false, reason: 'no_active_dialog' };
      }

      const dialog = this.dialogs.get(session.dialogId);
      if (!dialog) {
        return { handled: false, reason: 'dialog_not_found' };
      }

      // Verifica timeout
      if (Date.now() - session.lastActivity > dialog.timeout) {
        this.endDialog(chatId, 'timeout');
        return { handled: false, reason: 'timeout' };
      }

      // Busca transição aplicável
      const currentState = dialog.states[session.currentState];
      let matchedTransition = null;

      for (const transition of dialog.transitions) {
        if (transition.from !== session.currentState && transition.from !== '*') continue;

        // Verifica trigger
        if (this._matchesTrigger(transition.trigger, input, context)) {
          // Verifica condição se existir
          if (!transition.condition || this._evaluateCondition(transition.condition, session, context)) {
            matchedTransition = transition;
            break;
          }
        }
      }

      if (!matchedTransition) {
        // Verifica fallback do estado atual
        if (currentState?.fallback) {
          return {
            handled: true,
            response: currentState.fallback,
            state: session.currentState,
            transitioned: false
          };
        }
        return { handled: false, reason: 'no_matching_transition' };
      }

      // Executa transição
      const previousState = session.currentState;
      
      // Hook onExit
      this._executeHook('onExit', session.dialogId, previousState, session);

      // Atualiza estado
      session.currentState = matchedTransition.to;
      session.lastActivity = Date.now();
      session.history.push({
        state: matchedTransition.to,
        from: previousState,
        trigger: matchedTransition.trigger,
        timestamp: Date.now()
      });

      // Executa ação da transição
      if (matchedTransition.action) {
        this._executeAction(matchedTransition.action, session, context);
      }

      // Hook onEnter
      this._executeHook('onEnter', session.dialogId, matchedTransition.to, session);

      // Hooks globais de transição
      this.hooks.onTransition.forEach(hook => {
        try { hook(session, previousState, matchedTransition.to); } catch (error) { try { globalThis.WHLLogger?.debug?.('[Suppressed]', error); } catch (_) {} }
      });

      // Verifica se é estado final
      const newState = dialog.states[matchedTransition.to];
      if (newState?.final) {
        this.endDialog(chatId, 'completed');
      }

      this.saveDialogs();

      return {
        handled: true,
        response: newState?.response || matchedTransition.response,
        state: matchedTransition.to,
        transitioned: true,
        previousState,
        data: session.data
      };
    }

    /**
     * Verifica se trigger corresponde ao input
     */
    _matchesTrigger(trigger, input, context) {
      if (typeof trigger === 'string') {
        // Trigger simples - verifica se input contém
        return input.toLowerCase().includes(trigger.toLowerCase());
      }
      
      if (trigger instanceof RegExp) {
        return trigger.test(input);
      }
      
      if (typeof trigger === 'object') {
        // Trigger complexo
        if (trigger.type === 'intent' && context.intent) {
          return context.intent === trigger.value;
        }
        if (trigger.type === 'entity' && context.entities) {
          return context.entities.some(e => e.type === trigger.value);
        }
        if (trigger.type === 'sentiment' && context.sentiment !== undefined) {
          return this._compareSentiment(context.sentiment, trigger.value, trigger.operator);
        }
        if (trigger.type === 'keyword') {
          const keywords = Array.isArray(trigger.value) ? trigger.value : [trigger.value];
          return keywords.some(k => input.toLowerCase().includes(k.toLowerCase()));
        }
        if (trigger.type === 'any') {
          return true;
        }
      }
      
      if (typeof trigger === 'function') {
        return trigger(input, context);
      }
      
      return false;
    }

    _compareSentiment(value, target, operator = 'eq') {
      switch (operator) {
        case 'lt': return value < target;
        case 'lte': return value <= target;
        case 'gt': return value > target;
        case 'gte': return value >= target;
        case 'eq': default: return Math.abs(value - target) < 0.1;
      }
    }

    _evaluateCondition(condition, session, context) {
      if (typeof condition === 'function') {
        return condition(session, context);
      }
      if (typeof condition === 'object') {
        // Condição baseada em dados da sessão
        const { field, operator, value } = condition;
        const fieldValue = this._getNestedValue(session.data, field);
        return this._compare(fieldValue, value, operator);
      }
      return true;
    }

    _getNestedValue(obj, path) {
      return path.split('.').reduce((o, k) => o?.[k], obj);
    }

    _compare(a, b, operator = 'eq') {
      switch (operator) {
        case 'eq': return a === b;
        case 'neq': return a !== b;
        case 'gt': return a > b;
        case 'gte': return a >= b;
        case 'lt': return a < b;
        case 'lte': return a <= b;
        case 'contains': return String(a).includes(b);
        case 'exists': return a !== undefined && a !== null;
        default: return a === b;
      }
    }

    _executeAction(action, session, context) {
      if (typeof action === 'function') {
        action(session, context);
      } else if (typeof action === 'object') {
        // Ação declarativa
        if (action.set) {
          Object.entries(action.set).forEach(([key, value]) => {
            session.data[key] = typeof value === 'function' ? value(session, context) : value;
          });
        }
        if (action.increment) {
          Object.entries(action.increment).forEach(([key, value]) => {
            session.data[key] = (session.data[key] || 0) + value;
          });
        }
        if (action.emit && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(action.emit, { detail: { session, context } }));
        }
      }
    }

    _executeHook(hookType, dialogId, state, session) {
      const key = `${dialogId}:${state}`;
      const hooks = this.hooks[hookType].get(key) || [];
      hooks.forEach(hook => {
        try { hook(session); } catch (e) { console.warn(`[DialogManager] Hook error:`, e); }
      });
    }

    /**
     * Registra hook para estado
     */
    onEnterState(dialogId, state, callback) {
      const key = `${dialogId}:${state}`;
      if (!this.hooks.onEnter.has(key)) this.hooks.onEnter.set(key, []);
      this.hooks.onEnter.get(key).push(callback);
    }

    onExitState(dialogId, state, callback) {
      const key = `${dialogId}:${state}`;
      if (!this.hooks.onExit.has(key)) this.hooks.onExit.set(key, []);
      this.hooks.onExit.get(key).push(callback);
    }

    onTransition(callback) {
      this.hooks.onTransition.push(callback);
    }

    /**
     * Encerra diálogo
     */
    endDialog(chatId, reason = 'manual') {
      const session = this.activeDialogs.get(chatId);
      if (session) {
        session.endedAt = Date.now();
        session.endReason = reason;
        this.activeDialogs.delete(chatId);
        this.saveDialogs();
        return session;
      }
      return null;
    }

    /**
     * Obtém estado atual
     */
    getCurrentState(chatId) {
      const session = this.activeDialogs.get(chatId);
      return session ? session.currentState : null;
    }

    /**
     * Obtém sessão ativa
     */
    getActiveSession(chatId) {
      return this.activeDialogs.get(chatId) || null;
    }

    /**
     * Lista diálogos ativos
     */
    getActiveDialogs() {
      return Array.from(this.activeDialogs.entries()).map(([chatId, session]) => ({
        chatId,
        dialogId: session.dialogId,
        currentState: session.currentState,
        startedAt: session.startedAt,
        lastActivity: session.lastActivity
      }));
    }

    /**
     * Força transição para estado específico
     */
    forceState(chatId, newState) {
      const session = this.activeDialogs.get(chatId);
      if (!session) return false;

      const dialog = this.dialogs.get(session.dialogId);
      if (!dialog.states[newState]) return false;

      const previousState = session.currentState;
      this._executeHook('onExit', session.dialogId, previousState, session);
      
      session.currentState = newState;
      session.history.push({
        state: newState,
        from: previousState,
        trigger: 'force',
        timestamp: Date.now()
      });
      
      this._executeHook('onEnter', session.dialogId, newState, session);
      this.saveDialogs();
      return true;
    }

    /**
     * Atualiza dados da sessão
     */
    updateSessionData(chatId, data) {
      const session = this.activeDialogs.get(chatId);
      if (session) {
        session.data = { ...session.data, ...data };
        this.saveDialogs();
        return true;
      }
      return false;
    }
  }

  // ============================================================
  // 🏷️ ENTITY MANAGER
  // Extração de entidades com fuzzy matching
  // ============================================================
  class EntityManager {
    constructor() {
      this.extractors = new Map();
      this.customEntities = new Map();
      this.synonyms = new Map();
      this._registerDefaultExtractors();
      this.loadEntities();
    }

    async loadEntities() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.ENTITIES);
        if (data[STORAGE_KEYS.ENTITIES]) {
          const parsed = JSON.parse(data[STORAGE_KEYS.ENTITIES]);
          Object.entries(parsed.customEntities || {}).forEach(([k, v]) => this.customEntities.set(k, v));
          Object.entries(parsed.synonyms || {}).forEach(([k, v]) => this.synonyms.set(k, v));
        }
      } catch (e) {
        console.warn('[EntityManager] Erro ao carregar:', e);
      }
    }

    async saveEntities() {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.ENTITIES]: JSON.stringify({
            customEntities: Object.fromEntries(this.customEntities),
            synonyms: Object.fromEntries(this.synonyms)
          })
        });
      } catch (e) {
        console.warn('[EntityManager] Erro ao salvar:', e);
      }
    }

    _registerDefaultExtractors() {
      // Email
      this.registerExtractor('email', {
        type: 'regex',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
        normalize: (match) => match.toLowerCase()
      });

      // Telefone BR
      this.registerExtractor('phone', {
        type: 'regex',
        pattern: /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g,
        normalize: (match) => match.replace(/\D/g, '')
      });

      // CPF
      this.registerExtractor('cpf', {
        type: 'regex',
        pattern: /\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}/g,
        normalize: (match) => match.replace(/\D/g, ''),
        validate: (value) => this._validateCPF(value)
      });

      // CNPJ
      this.registerExtractor('cnpj', {
        type: 'regex',
        pattern: /\d{2}[\s.]?\d{3}[\s.]?\d{3}[\s/]?\d{4}[\s-]?\d{2}/g,
        normalize: (match) => match.replace(/\D/g, '')
      });

      // CEP
      this.registerExtractor('cep', {
        type: 'regex',
        pattern: /\d{5}[\s-]?\d{3}/g,
        normalize: (match) => match.replace(/\D/g, '')
      });

      // Data BR
      this.registerExtractor('date', {
        type: 'regex',
        pattern: /\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4}/g,
        normalize: (match) => {
          const parts = match.split(/[\s/.-]/);
          if (parts.length === 3) {
            const [d, m, y] = parts;
            const year = y.length === 2 ? '20' + y : y;
            return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
          return match;
        }
      });

      // Hora
      this.registerExtractor('time', {
        type: 'regex',
        pattern: /\d{1,2}[\s:]?\d{2}(?:[\s:]?\d{2})?(?:\s*(?:h|hrs?|hours?|am|pm))?/gi,
        normalize: (match) => match.replace(/[^\d:]/g, '')
      });

      // Valor monetário
      this.registerExtractor('money', {
        type: 'regex',
        pattern: /R\$\s*[\d.,]+|\d+(?:[.,]\d{3})*(?:[.,]\d{2})?(?:\s*(?:reais|real|R\$))/gi,
        normalize: (match) => {
          const num = match.replace(/[^\d,]/g, '').replace(',', '.');
          return parseFloat(num);
        }
      });

      // Número de pedido/protocolo
      this.registerExtractor('order_number', {
        type: 'regex',
        pattern: /(?:pedido|protocolo|ordem|ticket|#)\s*(?:n[°º]?\s*)?(\d{4,})/gi,
        normalize: (match, groups) => groups?.[1] || match.replace(/\D/g, '')
      });

      // URL
      this.registerExtractor('url', {
        type: 'regex',
        pattern: /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi
      });

      // Quantidade
      this.registerExtractor('quantity', {
        type: 'regex',
        pattern: /\d+\s*(?:unidade|unid|un|pç|peça|item|kg|g|ml|l|litro|metro|m|cm)s?/gi,
        normalize: (match) => {
          const num = parseInt(match.replace(/\D/g, ''));
          const unit = match.replace(/[\d\s]/g, '').toLowerCase();
          return { value: num, unit };
        }
      });

      // Nome próprio (heurística simples)
      this.registerExtractor('person_name', {
        type: 'function',
        extract: (text) => {
          const patterns = [
            /(?:me\s+chamo|meu\s+nome\s+[eé]|sou\s+[oa]?\s*)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)*)/gi,
            /(?:aqui\s+[eé]\s+[oa]?\s*)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)/gi
          ];
          
          const names = [];
          patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
              names.push({ value: match[1], start: match.index, end: match.index + match[0].length });
            }
          });
          return names;
        }
      });
    }

    _validateCPF(cpf) {
      if (cpf.length !== 11) return false;
      if (/^(\d)\1+$/.test(cpf)) return false;
      
      let sum = 0;
      for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
      let d1 = (sum * 10) % 11;
      if (d1 === 10) d1 = 0;
      if (d1 !== parseInt(cpf[9])) return false;
      
      sum = 0;
      for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
      let d2 = (sum * 10) % 11;
      if (d2 === 10) d2 = 0;
      return d2 === parseInt(cpf[10]);
    }

    /**
     * Registra extrator customizado
     */
    registerExtractor(entityType, config) {
      this.extractors.set(entityType, {
        type: config.type || 'regex',
        pattern: config.pattern,
        extract: config.extract,
        normalize: config.normalize || ((v) => v),
        validate: config.validate || (() => true),
        priority: config.priority || 0
      });
    }

    /**
     * Registra lista de entidades customizadas
     */
    registerEntityList(entityType, values, options = {}) {
      this.customEntities.set(entityType, {
        values: values.map(v => typeof v === 'string' ? { value: v, canonical: v } : v),
        caseSensitive: options.caseSensitive || false,
        fuzzyMatch: options.fuzzyMatch !== false,
        threshold: options.threshold || 0.8
      });
      this.saveEntities();
    }

    /**
     * Adiciona sinônimos para uma entidade
     */
    addSynonyms(entityType, canonical, synonyms) {
      if (!this.synonyms.has(entityType)) {
        this.synonyms.set(entityType, new Map());
      }
      const entitySynonyms = this.synonyms.get(entityType);
      synonyms.forEach(syn => entitySynonyms.set(syn.toLowerCase(), canonical));
      this.saveEntities();
    }

    /**
     * Extrai todas as entidades de um texto
     */
    extractAll(text, options = {}) {
      const entities = [];
      const types = options.types || Array.from(this.extractors.keys());

      // Extrai de extractors registrados
      types.forEach(type => {
        const extractor = this.extractors.get(type);
        if (extractor) {
          const extracted = this._extractWithExtractor(text, type, extractor);
          entities.push(...extracted);
        }
      });

      // Extrai de listas customizadas
      this.customEntities.forEach((config, type) => {
        if (!options.types || options.types.includes(type)) {
          const extracted = this._extractFromList(text, type, config);
          entities.push(...extracted);
        }
      });

      // Remove duplicatas e ordena por posição
      return this._deduplicateEntities(entities);
    }

    _extractWithExtractor(text, type, extractor) {
      const results = [];

      if (extractor.type === 'regex' && extractor.pattern) {
        const pattern = new RegExp(extractor.pattern.source, extractor.pattern.flags);
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const rawValue = match[0];
          const normalizedValue = extractor.normalize(rawValue, match.slice(1));
          
          if (extractor.validate(normalizedValue)) {
            results.push({
              type,
              value: normalizedValue,
              raw: rawValue,
              start: match.index,
              end: match.index + rawValue.length,
              confidence: 1.0
            });
          }
        }
      } else if (extractor.type === 'function' && extractor.extract) {
        const extracted = extractor.extract(text);
        extracted.forEach(e => {
          results.push({
            type,
            value: extractor.normalize(e.value),
            raw: e.raw || e.value,
            start: e.start,
            end: e.end,
            confidence: e.confidence || 0.9
          });
        });
      }

      return results;
    }

    _extractFromList(text, type, config) {
      const results = [];
      const lowerText = config.caseSensitive ? text : text.toLowerCase();

      config.values.forEach(item => {
        const searchValue = config.caseSensitive ? item.value : item.value.toLowerCase();
        
        // Busca exata
        let index = lowerText.indexOf(searchValue);
        while (index !== -1) {
          results.push({
            type,
            value: item.canonical || item.value,
            raw: text.substring(index, index + item.value.length),
            start: index,
            end: index + item.value.length,
            confidence: 1.0
          });
          index = lowerText.indexOf(searchValue, index + 1);
        }

        // Fuzzy match se habilitado
        if (config.fuzzyMatch && results.length === 0) {
          const words = text.split(/\s+/);
          words.forEach((word, i) => {
            const similarity = this._calculateSimilarity(
              config.caseSensitive ? word : word.toLowerCase(),
              searchValue
            );
            if (similarity >= config.threshold) {
              const start = text.indexOf(word);
              results.push({
                type,
                value: item.canonical || item.value,
                raw: word,
                start,
                end: start + word.length,
                confidence: similarity,
                fuzzyMatch: true
              });
            }
          });
        }
      });

      return results;
    }

    /**
     * Calcula similaridade (Levenshtein normalizado)
     */
    _calculateSimilarity(a, b) {
      if (a === b) return 1;
      if (!a || !b) return 0;

      const matrix = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }

      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b[i - 1] === a[j - 1]) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }

      const distance = matrix[b.length][a.length];
      return 1 - distance / Math.max(a.length, b.length);
    }

    _deduplicateEntities(entities) {
      // Ordena por posição e depois por confiança
      entities.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return b.confidence - a.confidence;
      });

      // Remove sobreposições mantendo maior confiança
      const result = [];
      let lastEnd = -1;

      entities.forEach(entity => {
        if (entity.start >= lastEnd) {
          result.push(entity);
          lastEnd = entity.end;
        } else if (entity.confidence > result[result.length - 1]?.confidence) {
          result[result.length - 1] = entity;
          lastEnd = entity.end;
        }
      });

      return result;
    }

    /**
     * Extrai entidade específica
     */
    extract(text, entityType) {
      return this.extractAll(text, { types: [entityType] });
    }

    /**
     * Resolve sinônimos
     */
    resolveSynonym(entityType, value) {
      const synonymMap = this.synonyms.get(entityType);
      if (synonymMap) {
        return synonymMap.get(value.toLowerCase()) || value;
      }
      return value;
    }
  }

  // ============================================================
  // 🎯 INTENT MANAGER
  // Classificação de intenções
  // ============================================================
  class IntentManager {
    constructor() {
      this.intents = new Map();
      this.patterns = new Map();
      this.trainingData = [];
      this.confidenceThreshold = 0.6;
      this._registerDefaultIntents();
      this.loadIntents();
    }

    async loadIntents() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.INTENTS);
        if (data[STORAGE_KEYS.INTENTS]) {
          const parsed = JSON.parse(data[STORAGE_KEYS.INTENTS]);
          this.trainingData = parsed.trainingData || [];
        }
      } catch (e) {
        console.warn('[IntentManager] Erro ao carregar:', e);
      }
    }

    async saveIntents() {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.INTENTS]: JSON.stringify({
            trainingData: this.trainingData.slice(-1000)
          })
        });
      } catch (e) {
        console.warn('[IntentManager] Erro ao salvar:', e);
      }
    }

    _registerDefaultIntents() {
      // Saudação
      this.registerIntent('greeting', {
        patterns: [
          /^(oi|olá|ola|hey|hi|hello|bom dia|boa tarde|boa noite|e ai|eai|fala|opa)/i,
          /^(tudo bem|como vai|beleza)/i
        ],
        keywords: ['oi', 'olá', 'ola', 'hey', 'hello', 'bom dia', 'boa tarde', 'boa noite'],
        priority: 10
      });

      // Despedida
      this.registerIntent('farewell', {
        patterns: [
          /^(tchau|até|ate|bye|adeus|falou|flw|vlw)/i,
          /(obrigad[oa]|muito obrigad[oa]|valeu|thanks)/i
        ],
        keywords: ['tchau', 'até mais', 'adeus', 'bye', 'valeu'],
        priority: 10
      });

      // Pergunta
      this.registerIntent('question', {
        patterns: [
          /\?$/,
          /^(como|qual|quando|onde|por ?que|quem|quanto|o que|cade)/i,
          /(pode|poderia|consegue|sabe|tem como)/i
        ],
        priority: 5
      });

      // Reclamação
      this.registerIntent('complaint', {
        patterns: [
          /(problema|erro|bug|não funciona|nao funciona|travou|parou)/i,
          /(péssimo|pessimo|horrível|horrivel|absurdo|inadmissível)/i,
          /(reclamação|reclamacao|insatisfeito|decepcionado)/i
        ],
        keywords: ['problema', 'erro', 'bug', 'reclamação', 'insatisfeito', 'péssimo'],
        priority: 15,
        sentiment: 'negative'
      });

      // Urgente
      this.registerIntent('urgent', {
        patterns: [
          /(urgente|urgência|emergência|emergencia|imediato)/i,
          /(preciso agora|não pode esperar|crítico|critico)/i,
          /(socorro|help|asap)/i
        ],
        keywords: ['urgente', 'emergência', 'imediato', 'agora', 'crítico'],
        priority: 20
      });

      // Compra/Interesse
      this.registerIntent('purchase_interest', {
        patterns: [
          /(quero|queria|gostaria|interesse|comprar)/i,
          /(preço|preco|valor|quanto custa|tabela)/i,
          /(tem disponível|tem disponivel|tem estoque|disponibilidade)/i
        ],
        keywords: ['comprar', 'preço', 'valor', 'disponível', 'interesse'],
        priority: 12
      });

      // Suporte técnico
      this.registerIntent('technical_support', {
        patterns: [
          /(ajuda|suporte|assistência|assistencia)/i,
          /(como faço|como faz|não sei|nao sei|não consigo)/i,
          /(configurar|instalar|atualizar|resetar)/i
        ],
        keywords: ['ajuda', 'suporte', 'como faço', 'não consigo'],
        priority: 10
      });

      // Informação
      this.registerIntent('information', {
        patterns: [
          /(informação|informacao|saber|conhecer)/i,
          /(horário|horario|endereço|endereco|localização)/i,
          /(funciona|abre|fecha|atende)/i
        ],
        keywords: ['informação', 'horário', 'endereço', 'funcionamento'],
        priority: 8
      });

      // Cancelamento
      this.registerIntent('cancellation', {
        patterns: [
          /(cancelar|cancelamento|desistir|desistência)/i,
          /(não quero mais|nao quero mais|desfazer)/i,
          /(estornar|estorno|reembolso|devolver)/i
        ],
        keywords: ['cancelar', 'desistir', 'reembolso', 'devolver'],
        priority: 15
      });

      // Agradecimento
      this.registerIntent('thanks', {
        patterns: [
          /(obrigad[oa]|muito obrigad[oa]|agradeço|agradeco)/i,
          /(valeu|vlw|thanks|thank you)/i
        ],
        keywords: ['obrigado', 'obrigada', 'valeu', 'agradeço'],
        priority: 8
      });

      // Confirmação
      this.registerIntent('confirmation', {
        patterns: [
          /^(sim|ok|okay|certo|correto|isso|exato|confirmo|confirmado)$/i,
          /^(pode ser|tá|ta|beleza|blz|perfeito|combinado)$/i
        ],
        priority: 10
      });

      // Negação
      this.registerIntent('negation', {
        patterns: [
          /^(não|nao|nunca|negativo|nope|no)$/i,
          /^(de jeito nenhum|nem pensar|não quero)$/i
        ],
        priority: 10
      });
    }

    /**
     * Registra nova intenção
     */
    registerIntent(intentId, config) {
      this.intents.set(intentId, {
        id: intentId,
        patterns: config.patterns || [],
        keywords: config.keywords || [],
        priority: config.priority || 0,
        sentiment: config.sentiment || null,
        responses: config.responses || [],
        actions: config.actions || []
      });

      // Indexa patterns para busca rápida
      config.patterns?.forEach((pattern, idx) => {
        this.patterns.set(`${intentId}:${idx}`, { intent: intentId, pattern });
      });
    }

    /**
     * Classifica intenção do texto
     */
    classify(text, context = {}) {
      const scores = new Map();
      const normalizedText = text.toLowerCase().trim();

      // Score por patterns (regex)
      this.intents.forEach((intent, intentId) => {
        let score = 0;
        let matchedPatterns = [];

        intent.patterns.forEach(pattern => {
          if (pattern.test(text)) {
            score += 0.4;
            matchedPatterns.push(pattern.toString());
          }
        });

        // Score por keywords
        intent.keywords.forEach(keyword => {
          if (normalizedText.includes(keyword.toLowerCase())) {
            score += 0.2;
          }
        });

        // Ajuste por prioridade
        score *= (1 + intent.priority / 100);

        // Ajuste por contexto
        if (context.previousIntent === intentId) {
          score *= 0.8; // Reduz repetição
        }
        if (context.sentiment && intent.sentiment === context.sentiment) {
          score *= 1.2;
        }

        if (score > 0) {
          scores.set(intentId, { score: Math.min(score, 1), patterns: matchedPatterns });
        }
      });

      // Ajusta scores baseado em training data
      this._adjustScoresFromTraining(normalizedText, scores);

      // Ordena por score
      const sorted = Array.from(scores.entries())
        .sort((a, b) => b[1].score - a[1].score);

      if (sorted.length === 0) {
        return {
          intent: 'unknown',
          confidence: 0,
          alternatives: []
        };
      }

      const [topIntent, topData] = sorted[0];
      const alternatives = sorted.slice(1, 4).map(([intent, data]) => ({
        intent,
        confidence: data.score
      }));

      return {
        intent: topData.score >= this.confidenceThreshold ? topIntent : 'unknown',
        confidence: topData.score,
        matchedPatterns: topData.patterns,
        alternatives,
        allScores: Object.fromEntries(scores)
      };
    }

    _adjustScoresFromTraining(text, scores) {
      // Busca exemplos similares no training data
      const words = new Set(text.split(/\s+/));
      
      this.trainingData.forEach(example => {
        const exampleWords = new Set(example.text.toLowerCase().split(/\s+/));
        const intersection = new Set([...words].filter(x => exampleWords.has(x)));
        const similarity = intersection.size / Math.max(words.size, exampleWords.size);

        if (similarity > 0.5) {
          const currentScore = scores.get(example.intent)?.score || 0;
          scores.set(example.intent, {
            score: currentScore + similarity * 0.3 * (example.positive ? 1 : -0.5),
            patterns: scores.get(example.intent)?.patterns || []
          });
        }
      });
    }

    /**
     * Adiciona exemplo de treinamento
     */
    addTrainingExample(text, intent, positive = true) {
      this.trainingData.push({
        text: text.toLowerCase(),
        intent,
        positive,
        addedAt: Date.now()
      });
      this.saveIntents();
    }

    /**
     * Obtém configuração de intenção
     */
    getIntent(intentId) {
      return this.intents.get(intentId) || null;
    }

    /**
     * Lista todas as intenções
     */
    listIntents() {
      return Array.from(this.intents.keys());
    }

    /**
     * Define threshold de confiança
     */
    setConfidenceThreshold(threshold) {
      this.confidenceThreshold = threshold;
    }
  }

  // ============================================================
  // 👥 HUMAN ASSISTANCE SYSTEM
  // Escalação e gestão de agentes
  // ============================================================
  class HumanAssistanceSystem {
    constructor() {
      this.escalationQueue = [];
      this.agents = new Map();
      this.activeChats = new Map(); // chatId -> agentId
      this.config = {
        maxChatsPerAgent: 5,
        escalationTimeout: 300000, // 5 min
        autoAssign: true,
        priorityFactors: {
          sentiment: 0.3,
          waitTime: 0.3,
          urgency: 0.2,
          vip: 0.2
        }
      };
      this.stats = {
        totalEscalations: 0,
        resolved: 0,
        avgWaitTime: 0,
        avgHandleTime: 0
      };
      this.loadData();
    }

    async loadData() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.ESCALATIONS);
        if (data[STORAGE_KEYS.ESCALATIONS]) {
          const parsed = JSON.parse(data[STORAGE_KEYS.ESCALATIONS]);
          this.escalationQueue = parsed.queue || [];
          // SECURITY FIX (PARTIAL-004): Prevent prototype pollution via spread operator
          const sanitizedStats = sanitizeObject(parsed.stats || {});
          this.stats = { ...this.stats, ...sanitizedStats };
        }
      } catch (e) {
        console.warn('[HumanAssistance] Erro ao carregar:', e);
      }
    }

    async saveData() {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.ESCALATIONS]: JSON.stringify({
            queue: this.escalationQueue,
            stats: this.stats
          })
        });
      } catch (e) {
        console.warn('[HumanAssistance] Erro ao salvar:', e);
      }
    }

    /**
     * Registra um agente
     */
    registerAgent(agentId, info = {}) {
      this.agents.set(agentId, {
        id: agentId,
        name: info.name || agentId,
        status: 'offline',
        skills: info.skills || [],
        maxChats: info.maxChats || this.config.maxChatsPerAgent,
        activeChats: [],
        stats: {
          handled: 0,
          avgHandleTime: 0,
          satisfaction: 0
        },
        lastActivity: Date.now()
      });
      return this.agents.get(agentId);
    }

    /**
     * Atualiza status do agente
     */
    setAgentStatus(agentId, status) {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.status = status; // 'online', 'offline', 'busy', 'away'
        agent.lastActivity = Date.now();

        // Se voltou online e tem auto-assign, processa fila
        if (status === 'online' && this.config.autoAssign) {
          this._processQueue();
        }
        return true;
      }
      return false;
    }

    /**
     * Solicita escalação para humano
     */
    requestEscalation(chatId, context = {}) {
      // Verifica se já está na fila ou sendo atendido
      if (this.activeChats.has(chatId)) {
        return { success: false, reason: 'already_assigned', agentId: this.activeChats.get(chatId) };
      }
      if (this.escalationQueue.some(e => e.chatId === chatId)) {
        return { success: false, reason: 'already_in_queue' };
      }

      const priority = this._calculatePriority(context);
      const escalation = {
        id: `esc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        chatId,
        priority,
        context: {
          reason: context.reason || 'user_request',
          sentiment: context.sentiment,
          intent: context.intent,
          urgency: context.urgency || 0,
          isVIP: context.isVIP || false,
          customerName: context.customerName,
          summary: context.summary
        },
        requestedAt: Date.now(),
        status: 'pending'
      };

      // Insere na posição correta baseado em prioridade
      const insertIndex = this.escalationQueue.findIndex(e => e.priority < priority);
      if (insertIndex === -1) {
        this.escalationQueue.push(escalation);
      } else {
        this.escalationQueue.splice(insertIndex, 0, escalation);
      }

      this.stats.totalEscalations++;
      this.saveData();

      // Tenta assignment automático
      if (this.config.autoAssign) {
        const assigned = this._processQueue();
        if (assigned.includes(chatId)) {
          return { 
            success: true, 
            status: 'assigned',
            agentId: this.activeChats.get(chatId),
            position: 0
          };
        }
      }

      return {
        success: true,
        status: 'queued',
        position: this.escalationQueue.findIndex(e => e.chatId === chatId) + 1,
        estimatedWait: this._estimateWaitTime(escalation)
      };
    }

    _calculatePriority(context) {
      let priority = 50;
      const factors = this.config.priorityFactors;

      // Sentimento negativo aumenta prioridade
      if (context.sentiment !== undefined) {
        priority += (1 - context.sentiment) * 100 * factors.sentiment;
      }

      // Urgência
      if (context.urgency) {
        priority += context.urgency * 100 * factors.urgency;
      }

      // VIP
      if (context.isVIP) {
        priority += 100 * factors.vip;
      }

      return Math.min(100, Math.max(0, priority));
    }

    _estimateWaitTime(escalation) {
      const position = this.escalationQueue.indexOf(escalation);
      const availableAgents = this._getAvailableAgents().length;
      
      if (availableAgents === 0) {
        return -1; // Indeterminado
      }

      // Estimativa simples: posição / agentes disponíveis * tempo médio
      const avgHandleTime = this.stats.avgHandleTime || 300000; // 5 min default
      return Math.round((position / availableAgents) * avgHandleTime);
    }

    _getAvailableAgents() {
      return Array.from(this.agents.values()).filter(agent => {
        return agent.status === 'online' && agent.activeChats.length < agent.maxChats;
      });
    }

    _processQueue() {
      const assignedChats = [];
      const availableAgents = this._getAvailableAgents();

      while (this.escalationQueue.length > 0 && availableAgents.length > 0) {
        const escalation = this.escalationQueue[0];
        
        // Encontra melhor agente (considerando skills se houver)
        const bestAgent = this._findBestAgent(escalation, availableAgents);
        
        if (!bestAgent) break;

        // Faz assignment
        this._assignChat(escalation.chatId, bestAgent.id);
        this.escalationQueue.shift();
        escalation.status = 'assigned';
        escalation.assignedAt = Date.now();
        escalation.agentId = bestAgent.id;

        assignedChats.push(escalation.chatId);

        // Atualiza lista de disponíveis
        if (bestAgent.activeChats.length >= bestAgent.maxChats) {
          const idx = availableAgents.indexOf(bestAgent);
          if (idx > -1) availableAgents.splice(idx, 1);
        }
      }

      if (assignedChats.length > 0) {
        this.saveData();
      }

      return assignedChats;
    }

    _findBestAgent(escalation, availableAgents) {
      if (availableAgents.length === 0) return null;
      if (availableAgents.length === 1) return availableAgents[0];

      // Score cada agente
      let bestAgent = null;
      let bestScore = -1;

      availableAgents.forEach(agent => {
        let score = 0;

        // Menos chats ativos = melhor
        score += (1 - agent.activeChats.length / agent.maxChats) * 50;

        // Skill match
        if (escalation.context.intent && agent.skills.includes(escalation.context.intent)) {
          score += 30;
        }

        // Melhor satisfação histórica
        score += (agent.stats.satisfaction || 0.5) * 20;

        if (score > bestScore) {
          bestScore = score;
          bestAgent = agent;
        }
      });

      return bestAgent;
    }

    _assignChat(chatId, agentId) {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.activeChats.push({
          chatId,
          assignedAt: Date.now()
        });
        this.activeChats.set(chatId, agentId);
      }
    }

    /**
     * Finaliza atendimento
     */
    endChat(chatId, resolution = {}) {
      const agentId = this.activeChats.get(chatId);
      if (!agentId) return false;

      const agent = this.agents.get(agentId);
      if (agent) {
        const chatInfo = agent.activeChats.find(c => c.chatId === chatId);
        if (chatInfo) {
          const handleTime = Date.now() - chatInfo.assignedAt;
          
          // Atualiza stats do agente
          agent.stats.handled++;
          agent.stats.avgHandleTime = (agent.stats.avgHandleTime * (agent.stats.handled - 1) + handleTime) / agent.stats.handled;
          
          if (resolution.satisfaction !== undefined) {
            agent.stats.satisfaction = (agent.stats.satisfaction * (agent.stats.handled - 1) + resolution.satisfaction) / agent.stats.handled;
          }

          // Remove chat da lista ativa
          agent.activeChats = agent.activeChats.filter(c => c.chatId !== chatId);
        }
      }

      this.activeChats.delete(chatId);
      this.stats.resolved++;
      
      // Recalcula média geral
      // ...

      this.saveData();

      // Processa fila com vaga liberada
      if (this.config.autoAssign) {
        this._processQueue();
      }

      return true;
    }

    /**
     * Transfere chat para outro agente
     */
    transferChat(chatId, newAgentId) {
      const currentAgentId = this.activeChats.get(chatId);
      if (!currentAgentId) return { success: false, reason: 'chat_not_found' };

      const newAgent = this.agents.get(newAgentId);
      if (!newAgent) return { success: false, reason: 'agent_not_found' };
      if (newAgent.status !== 'online') return { success: false, reason: 'agent_not_available' };
      if (newAgent.activeChats.length >= newAgent.maxChats) return { success: false, reason: 'agent_full' };

      // Remove do agente atual
      const currentAgent = this.agents.get(currentAgentId);
      if (currentAgent) {
        currentAgent.activeChats = currentAgent.activeChats.filter(c => c.chatId !== chatId);
      }

      // Adiciona ao novo agente
      this._assignChat(chatId, newAgentId);
      this.saveData();

      return { success: true, previousAgent: currentAgentId, newAgent: newAgentId };
    }

    /**
     * Obtém posição na fila
     */
    getQueuePosition(chatId) {
      const index = this.escalationQueue.findIndex(e => e.chatId === chatId);
      if (index === -1) {
        if (this.activeChats.has(chatId)) {
          return { position: 0, status: 'assigned', agentId: this.activeChats.get(chatId) };
        }
        return { position: -1, status: 'not_found' };
      }
      
      const escalation = this.escalationQueue[index];
      return {
        position: index + 1,
        status: 'queued',
        estimatedWait: this._estimateWaitTime(escalation),
        priority: escalation.priority
      };
    }

    /**
     * Obtém status da fila
     */
    getQueueStatus() {
      return {
        queueLength: this.escalationQueue.length,
        activeChats: this.activeChats.size,
        availableAgents: this._getAvailableAgents().length,
        totalAgents: this.agents.size,
        onlineAgents: Array.from(this.agents.values()).filter(a => a.status === 'online').length,
        stats: this.stats
      };
    }

    /**
     * Obtém agentes
     */
    getAgents() {
      return Array.from(this.agents.values()).map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        activeChats: a.activeChats.length,
        maxChats: a.maxChats,
        stats: a.stats
      }));
    }

    /**
     * Cancela escalação
     */
    cancelEscalation(chatId) {
      const index = this.escalationQueue.findIndex(e => e.chatId === chatId);
      if (index > -1) {
        this.escalationQueue.splice(index, 1);
        this.saveData();
        return true;
      }
      return false;
    }
  }

  // ============================================================
  // 💾 CACHE MANAGER
  // Cache com LRU eviction e TTL
  // ============================================================
  class CacheManager {
    constructor(options = {}) {
      this.maxSize = options.maxSize || 1000;
      this.defaultTTL = options.defaultTTL || 300000; // 5 min
      this.cache = new Map();
      this.accessOrder = [];
      this.stats = {
        hits: 0,
        misses: 0,
        evictions: 0
      };
      
      // Cleanup periódico
      this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
    }

    /**
     * Obtém valor do cache
     */
    get(key) {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Verifica TTL
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.delete(key);
        this.stats.misses++;
        return null;
      }

      // Atualiza ordem de acesso (LRU)
      this._updateAccessOrder(key);
      this.stats.hits++;
      
      return entry.value;
    }

    /**
     * Define valor no cache
     */
    set(key, value, ttl = null) {
      // Verifica se precisa evictar
      if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
        this._evict();
      }

      const entry = {
        value,
        createdAt: Date.now(),
        expiresAt: ttl !== null ? Date.now() + ttl : (this.defaultTTL ? Date.now() + this.defaultTTL : null),
        accessCount: 0
      };

      this.cache.set(key, entry);
      this._updateAccessOrder(key);
      
      return true;
    }

    /**
     * Verifica se chave existe
     */
    has(key) {
      const entry = this.cache.get(key);
      if (!entry) return false;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.delete(key);
        return false;
      }
      return true;
    }

    /**
     * Remove do cache
     */
    delete(key) {
      const deleted = this.cache.delete(key);
      if (deleted) {
        const idx = this.accessOrder.indexOf(key);
        if (idx > -1) this.accessOrder.splice(idx, 1);
      }
      return deleted;
    }

    /**
     * Limpa todo o cache
     */
    clear() {
      this.cache.clear();
      this.accessOrder = [];
    }

    /**
     * Obtém ou define (getOrSet)
     */
    async getOrSet(key, factory, ttl = null) {
      const existing = this.get(key);
      if (existing !== null) return existing;

      const value = typeof factory === 'function' ? await factory() : factory;
      this.set(key, value, ttl);
      return value;
    }

    /**
     * Atualiza TTL de uma entrada
     */
    touch(key, ttl = null) {
      const entry = this.cache.get(key);
      if (entry) {
        entry.expiresAt = ttl !== null ? Date.now() + ttl : (this.defaultTTL ? Date.now() + this.defaultTTL : null);
        return true;
      }
      return false;
    }

    _updateAccessOrder(key) {
      const idx = this.accessOrder.indexOf(key);
      if (idx > -1) this.accessOrder.splice(idx, 1);
      this.accessOrder.push(key);
      
      const entry = this.cache.get(key);
      if (entry) entry.accessCount++;
    }

    _evict() {
      // LRU: remove o item menos recentemente usado
      if (this.accessOrder.length > 0) {
        const keyToRemove = this.accessOrder.shift();
        this.cache.delete(keyToRemove);
        this.stats.evictions++;
      }
    }

    _cleanup() {
      const now = Date.now();
      const keysToDelete = [];

      this.cache.forEach((entry, key) => {
        if (entry.expiresAt && now > entry.expiresAt) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => this.delete(key));
    }

    /**
     * Obtém estatísticas
     */
    getStats() {
      return {
        size: this.cache.size,
        maxSize: this.maxSize,
        hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
        ...this.stats
      };
    }

    /**
     * Lista chaves
     */
    keys() {
      return Array.from(this.cache.keys());
    }

    /**
     * Obtém tamanho
     */
    size() {
      return this.cache.size;
    }

    /**
     * Destroi o cache manager
     */
    destroy() {
      clearInterval(this.cleanupInterval);
      this.clear();
    }
  }

  // ============================================================
  // ⏱️ RATE LIMIT MANAGER
  // Token bucket algorithm
  // ============================================================
  class RateLimitManager {
    constructor() {
      this.limiters = new Map();
      this.blocked = new Map();
      this.stats = {
        allowed: 0,
        blocked: 0,
        totalRequests: 0
      };
    }

    /**
     * Configura limite para uma chave/recurso
     */
    configure(key, config) {
      this.limiters.set(key, {
        maxTokens: config.maxTokens || config.requests || 10,
        refillRate: config.refillRate || config.requests || 10,
        refillInterval: config.refillInterval || config.window || 60000,
        tokens: config.maxTokens || config.requests || 10,
        lastRefill: Date.now(),
        blockDuration: config.blockDuration || 0
      });
    }

    /**
     * Verifica se requisição é permitida
     */
    isAllowed(key, tokens = 1) {
      this.stats.totalRequests++;

      // Verifica se está bloqueado
      const blockInfo = this.blocked.get(key);
      if (blockInfo && Date.now() < blockInfo.until) {
        this.stats.blocked++;
        return {
          allowed: false,
          reason: 'blocked',
          retryAfter: blockInfo.until - Date.now(),
          remaining: 0
        };
      } else if (blockInfo) {
        this.blocked.delete(key);
      }

      // Obtém ou cria limiter
      let limiter = this.limiters.get(key);
      if (!limiter) {
        // Usa config default
        this.configure(key, { requests: 60, window: 60000 });
        limiter = this.limiters.get(key);
      }

      // Refill tokens
      this._refillTokens(limiter);

      // Verifica tokens disponíveis
      if (limiter.tokens >= tokens) {
        limiter.tokens -= tokens;
        this.stats.allowed++;
        return {
          allowed: true,
          remaining: limiter.tokens,
          resetAt: limiter.lastRefill + limiter.refillInterval
        };
      }

      // Rate limited
      this.stats.blocked++;

      // Aplica bloqueio se configurado
      if (limiter.blockDuration > 0) {
        this.blocked.set(key, {
          until: Date.now() + limiter.blockDuration,
          reason: 'rate_limit_exceeded'
        });
      }

      return {
        allowed: false,
        reason: 'rate_limited',
        remaining: limiter.tokens,
        retryAfter: limiter.refillInterval - (Date.now() - limiter.lastRefill),
        resetAt: limiter.lastRefill + limiter.refillInterval
      };
    }

    /**
     * Consome tokens (alias para isAllowed com side-effect)
     */
    consume(key, tokens = 1) {
      return this.isAllowed(key, tokens);
    }

    _refillTokens(limiter) {
      const now = Date.now();
      const elapsed = now - limiter.lastRefill;

      if (elapsed >= limiter.refillInterval) {
        const refillCount = Math.floor(elapsed / limiter.refillInterval);
        limiter.tokens = Math.min(
          limiter.maxTokens,
          limiter.tokens + refillCount * limiter.refillRate
        );
        limiter.lastRefill = now - (elapsed % limiter.refillInterval);
      }
    }

    /**
     * Bloqueia uma chave manualmente
     */
    block(key, duration = 60000) {
      this.blocked.set(key, {
        until: Date.now() + duration,
        reason: 'manual_block'
      });
    }

    /**
     * Desbloqueia uma chave
     */
    unblock(key) {
      return this.blocked.delete(key);
    }

    /**
     * Reseta limite de uma chave
     */
    reset(key) {
      const limiter = this.limiters.get(key);
      if (limiter) {
        limiter.tokens = limiter.maxTokens;
        limiter.lastRefill = Date.now();
      }
      this.blocked.delete(key);
    }

    /**
     * Obtém status de uma chave
     */
    getStatus(key) {
      const limiter = this.limiters.get(key);
      const blockInfo = this.blocked.get(key);

      if (blockInfo && Date.now() < blockInfo.until) {
        return {
          status: 'blocked',
          retryAfter: blockInfo.until - Date.now()
        };
      }

      if (!limiter) {
        return { status: 'not_configured' };
      }

      this._refillTokens(limiter);

      return {
        status: 'active',
        tokens: limiter.tokens,
        maxTokens: limiter.maxTokens,
        resetAt: limiter.lastRefill + limiter.refillInterval
      };
    }

    /**
     * Obtém estatísticas
     */
    getStats() {
      return {
        ...this.stats,
        blockRate: this.stats.blocked / this.stats.totalRequests || 0,
        activeLimiters: this.limiters.size,
        blockedKeys: this.blocked.size
      };
    }
  }

  // ============================================================
  // 🗂️ CONTEXT MANAGER
  // Contexto aninhado com TTL
  // ============================================================
  class ContextManager {
    constructor(options = {}) {
      this.contexts = new Map();
      this.defaultTTL = options.defaultTTL || 1800000; // 30 min
      this.maxDepth = options.maxDepth || 10;
      
      // Cleanup periódico
      this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
    }

    /**
     * Define valor no contexto
     */
    set(contextId, key, value, ttl = null) {
      // SECURITY FIX (PARTIAL-004): Prevent prototype pollution via nested keys
      if (!isSafeKey(key)) {
        console.error(`[ContextManager] Blocked dangerous key: ${key}`);
        return false;
      }

      let context = this.contexts.get(contextId);
      if (!context) {
        context = {
          id: contextId,
          data: {},
          metadata: {},
          createdAt: Date.now(),
          lastAccess: Date.now()
        };
        this.contexts.set(contextId, context);
      }

      // Suporta chaves aninhadas (ex: "user.profile.name")
      const keys = key.split('.');
      let current = context.data;

      for (let i = 0; i < keys.length - 1; i++) {
        // SECURITY FIX (PARTIAL-004): Additional validation per key part
        if (!isSafeKey(keys[i])) {
          console.error(`[ContextManager] Blocked dangerous nested key: ${keys[i]}`);
          return false;
        }

        if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      // SECURITY FIX (PARTIAL-004): Validate final key
      const finalKey = keys[keys.length - 1];
      if (!isSafeKey(finalKey)) {
        console.error(`[ContextManager] Blocked dangerous final key: ${finalKey}`);
        return false;
      }

      current[finalKey] = value;

      // Metadata com TTL
      context.metadata[key] = {
        setAt: Date.now(),
        expiresAt: ttl !== null ? Date.now() + ttl : Date.now() + this.defaultTTL
      };

      context.lastAccess = Date.now();
      return true;
    }

    /**
     * Obtém valor do contexto
     */
    get(contextId, key, defaultValue = undefined) {
      const context = this.contexts.get(contextId);
      if (!context) return defaultValue;

      // Verifica TTL
      const meta = context.metadata[key];
      if (meta && Date.now() > meta.expiresAt) {
        this.delete(contextId, key);
        return defaultValue;
      }

      // Navega chaves aninhadas
      const keys = key.split('.');
      let current = context.data;

      for (const k of keys) {
        if (current === undefined || current === null) return defaultValue;
        current = current[k];
      }

      context.lastAccess = Date.now();
      return current !== undefined ? current : defaultValue;
    }

    /**
     * Verifica se chave existe
     */
    has(contextId, key) {
      return this.get(contextId, key) !== undefined;
    }

    /**
     * Remove chave do contexto
     */
    delete(contextId, key) {
      const context = this.contexts.get(contextId);
      if (!context) return false;

      const keys = key.split('.');
      let current = context.data;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) return false;
        current = current[keys[i]];
      }

      delete current[keys[keys.length - 1]];
      delete context.metadata[key];
      return true;
    }

    /**
     * Obtém contexto inteiro
     */
    getContext(contextId) {
      const context = this.contexts.get(contextId);
      if (!context) return null;

      // Limpa expirados
      this._cleanExpired(context);
      context.lastAccess = Date.now();
      return { ...context.data };
    }

    /**
     * Mescla dados no contexto
     */
    merge(contextId, data, ttl = null) {
      // SECURITY FIX (PARTIAL-004): Sanitize data before merging to prevent prototype pollution
      if (!data || typeof data !== 'object') {
        console.error('[ContextManager] Invalid data for merge');
        return;
      }

      const sanitizedData = sanitizeObject(data);

      Object.entries(sanitizedData).forEach(([key, value]) => {
        // set() already validates keys, but sanitizedData ensures no dangerous keys exist
        this.set(contextId, key, value, ttl);
      });
    }

    /**
     * Limpa contexto inteiro
     */
    clearContext(contextId) {
      return this.contexts.delete(contextId);
    }

    /**
     * Push para array no contexto
     */
    push(contextId, key, value, maxLength = 100) {
      const arr = this.get(contextId, key, []);
      arr.push(value);
      if (arr.length > maxLength) {
        arr.shift();
      }
      this.set(contextId, key, arr);
      return arr.length;
    }

    /**
     * Incrementa valor numérico
     */
    increment(contextId, key, amount = 1) {
      const current = this.get(contextId, key, 0);
      const newValue = (typeof current === 'number' ? current : 0) + amount;
      this.set(contextId, key, newValue);
      return newValue;
    }

    _cleanExpired(context) {
      const now = Date.now();
      Object.entries(context.metadata).forEach(([key, meta]) => {
        if (now > meta.expiresAt) {
          this.delete(context.id, key);
        }
      });
    }

    _cleanup() {
      const now = Date.now();
      this.contexts.forEach((context, contextId) => {
        // Remove contextos inativos por muito tempo
        if (now - context.lastAccess > this.defaultTTL * 2) {
          this.contexts.delete(contextId);
        } else {
          this._cleanExpired(context);
        }
      });
    }

    /**
     * Lista contextos ativos
     */
    listContexts() {
      return Array.from(this.contexts.keys());
    }

    /**
     * Obtém estatísticas
     */
    getStats() {
      return {
        totalContexts: this.contexts.size,
        contexts: Array.from(this.contexts.entries()).map(([id, ctx]) => ({
          id,
          keysCount: Object.keys(ctx.data).length,
          lastAccess: ctx.lastAccess,
          age: Date.now() - ctx.createdAt
        }))
      };
    }

    /**
     * Destroi o context manager
     */
    destroy() {
      clearInterval(this.cleanupInterval);
      this.contexts.clear();
    }
  }

  // ============================================================
  // 🔐 SESSION MANAGER
  // Lifecycle de sessões com timeout
  // ============================================================
  class SessionManager {
    constructor(options = {}) {
      this.sessions = new Map();
      this.defaultTimeout = options.timeout || 1800000; // 30 min
      this.maxSessions = options.maxSessions || 10000;
      this.onExpire = options.onExpire || null;
      
      // Cleanup periódico
      this.cleanupInterval = setInterval(() => this._cleanup(), 30000);
    }

    /**
     * Cria nova sessão
     */
    create(sessionId, data = {}) {
      // Verifica limite
      if (this.sessions.size >= this.maxSessions) {
        this._evictOldest();
      }

      const session = {
        id: sessionId,
        data: { ...data },
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + this.defaultTimeout,
        metadata: {
          userAgent: data.userAgent,
          ip: data.ip
        }
      };

      this.sessions.set(sessionId, session);
      return session;
    }

    /**
     * Obtém sessão
     */
    get(sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) return null;

      // Verifica expiração
      if (Date.now() > session.expiresAt) {
        this._expireSession(sessionId);
        return null;
      }

      return session;
    }

    /**
     * Atualiza atividade da sessão (touch)
     */
    touch(sessionId) {
      const session = this.sessions.get(sessionId);
      if (session && Date.now() <= session.expiresAt) {
        session.lastActivity = Date.now();
        session.expiresAt = Date.now() + this.defaultTimeout;
        return true;
      }
      return false;
    }

    /**
     * Atualiza dados da sessão
     */
    update(sessionId, data) {
      const session = this.get(sessionId);
      if (session) {
        session.data = { ...session.data, ...data };
        session.lastActivity = Date.now();
        return true;
      }
      return false;
    }

    /**
     * Define valor específico na sessão
     */
    set(sessionId, key, value) {
      const session = this.get(sessionId);
      if (session) {
        session.data[key] = value;
        session.lastActivity = Date.now();
        return true;
      }
      return false;
    }

    /**
     * Obtém valor específico da sessão
     */
    getValue(sessionId, key, defaultValue = undefined) {
      const session = this.get(sessionId);
      return session ? (session.data[key] ?? defaultValue) : defaultValue;
    }

    /**
     * Destroi sessão
     */
    destroy(sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        this.sessions.delete(sessionId);
        return true;
      }
      return false;
    }

    /**
     * Verifica se sessão existe e é válida
     */
    isValid(sessionId) {
      const session = this.sessions.get(sessionId);
      return session && Date.now() <= session.expiresAt;
    }

    /**
     * Renova sessão com novo timeout
     */
    renew(sessionId, timeout = null) {
      const session = this.get(sessionId);
      if (session) {
        session.expiresAt = Date.now() + (timeout || this.defaultTimeout);
        session.lastActivity = Date.now();
        return session.expiresAt;
      }
      return null;
    }

    /**
     * Obtém ou cria sessão
     */
    getOrCreate(sessionId, initialData = {}) {
      let session = this.get(sessionId);
      if (!session) {
        session = this.create(sessionId, initialData);
      }
      return session;
    }

    _expireSession(sessionId) {
      const session = this.sessions.get(sessionId);
      if (session && this.onExpire) {
        try {
          this.onExpire(session);
        } catch (e) {
          console.warn('[SessionManager] onExpire error:', e);
        }
      }
      this.sessions.delete(sessionId);
    }

    _evictOldest() {
      let oldest = null;
      let oldestTime = Infinity;

      this.sessions.forEach((session, id) => {
        if (session.lastActivity < oldestTime) {
          oldestTime = session.lastActivity;
          oldest = id;
        }
      });

      if (oldest) {
        this._expireSession(oldest);
      }
    }

    _cleanup() {
      const now = Date.now();
      const toExpire = [];

      this.sessions.forEach((session, id) => {
        if (now > session.expiresAt) {
          toExpire.push(id);
        }
      });

      toExpire.forEach(id => this._expireSession(id));
    }

    /**
     * Lista sessões ativas
     */
    listSessions() {
      return Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
        timeToExpire: session.expiresAt - Date.now()
      }));
    }

    /**
     * Obtém estatísticas
     */
    getStats() {
      const now = Date.now();
      let totalAge = 0;
      let activeCount = 0;

      this.sessions.forEach(session => {
        if (now <= session.expiresAt) {
          activeCount++;
          totalAge += now - session.createdAt;
        }
      });

      return {
        totalSessions: this.sessions.size,
        activeSessions: activeCount,
        avgAge: activeCount > 0 ? totalAge / activeCount : 0,
        maxSessions: this.maxSessions
      };
    }

    /**
     * Destroi o session manager
     */
    destroy() {
      clearInterval(this.cleanupInterval);
      this.sessions.clear();
    }
  }

  // ============================================================
  // 📊 FEEDBACK ANALYZER
  // Análise avançada de feedback
  // ============================================================
  class FeedbackAnalyzer {
    constructor() {
      this.feedbacks = [];
      this.aggregates = {
        totalCount: 0,
        avgRating: 0,
        sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
        topIssues: [],
        topPraises: [],
        nps: 0
      };
      this.keywords = {
        positive: ['ótimo', 'excelente', 'perfeito', 'rápido', 'atencioso', 'resolveu', 'recomendo', 'parabéns'],
        negative: ['ruim', 'péssimo', 'demorou', 'não resolveu', 'problema', 'decepcionado', 'horrível'],
        issues: ['demora', 'erro', 'bug', 'lento', 'confuso', 'difícil', 'complicado'],
        praises: ['rápido', 'fácil', 'claro', 'eficiente', 'educado', 'prestativo']
      };
      this.loadData();
    }

    async loadData() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.FEEDBACK);
        if (data[STORAGE_KEYS.FEEDBACK]) {
          const parsed = JSON.parse(data[STORAGE_KEYS.FEEDBACK]);
          this.feedbacks = parsed.feedbacks || [];
          // SECURITY FIX (PARTIAL-004): Prevent prototype pollution via spread operator
          const sanitizedAggregates = sanitizeObject(parsed.aggregates || {});
          this.aggregates = { ...this.aggregates, ...sanitizedAggregates };
        }
      } catch (e) {
        console.warn('[FeedbackAnalyzer] Erro ao carregar:', e);
      }
    }

    async saveData() {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.FEEDBACK]: JSON.stringify({
            feedbacks: this.feedbacks.slice(-1000),
            aggregates: this.aggregates
          })
        });
      } catch (e) {
        console.warn('[FeedbackAnalyzer] Erro ao salvar:', e);
      }
    }

    /**
     * Adiciona feedback para análise
     */
    addFeedback(feedback) {
      const analysis = this._analyzeFeedback(feedback);
      
      const entry = {
        id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        rating: feedback.rating,
        text: feedback.text || '',
        source: feedback.source || 'direct',
        context: feedback.context || {},
        analysis,
        createdAt: Date.now()
      };

      this.feedbacks.push(entry);
      this._updateAggregates(entry);
      this.saveData();

      return entry;
    }

    _analyzeFeedback(feedback) {
      const text = (feedback.text || '').toLowerCase();
      
      // Análise de sentimento
      let sentimentScore = 0.5;
      if (feedback.rating) {
        sentimentScore = feedback.rating / 5;
      }
      
      // Ajusta baseado em keywords
      this.keywords.positive.forEach(kw => {
        if (text.includes(kw)) sentimentScore += 0.1;
      });
      this.keywords.negative.forEach(kw => {
        if (text.includes(kw)) sentimentScore -= 0.1;
      });
      sentimentScore = Math.max(0, Math.min(1, sentimentScore));

      // Extrai issues mencionadas
      const issues = this.keywords.issues.filter(kw => text.includes(kw));
      
      // Extrai praises
      const praises = this.keywords.praises.filter(kw => text.includes(kw));

      // Extrai keywords relevantes
      const extractedKeywords = this._extractKeywords(text);

      // Categoriza
      let category = 'general';
      if (issues.length > praises.length) category = 'complaint';
      else if (praises.length > issues.length) category = 'praise';
      else if (text.includes('?')) category = 'question';
      else if (text.includes('sugestão') || text.includes('sugiro')) category = 'suggestion';

      return {
        sentiment: {
          score: sentimentScore,
          label: sentimentScore > 0.6 ? 'positive' : sentimentScore < 0.4 ? 'negative' : 'neutral'
        },
        issues,
        praises,
        keywords: extractedKeywords,
        category,
        wordCount: text.split(/\s+/).filter(w => w.length > 0).length
      };
    }

    _extractKeywords(text) {
      // Stopwords em português
      const stopwords = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'em', 'um', 'uma', 'para', 'com', 'não', 'que', 'se', 'na', 'no', 'por', 'mais', 'as', 'os', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'estão', 'você', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'têm', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'será', 'nós', 'tenho', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este', 'fosse', 'dele']);

      const words = text.toLowerCase()
        .replace(/[^\w\sáéíóúâêôãõç]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopwords.has(w));

      // Conta frequência
      const freq = {};
      words.forEach(w => {
        freq[w] = (freq[w] || 0) + 1;
      });

      // Retorna top keywords
      return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word, count]) => ({ word, count }));
    }

    _updateAggregates(entry) {
      this.aggregates.totalCount++;

      // Atualiza média de rating
      if (entry.rating) {
        this.aggregates.avgRating = (
          (this.aggregates.avgRating * (this.aggregates.totalCount - 1) + entry.rating) / 
          this.aggregates.totalCount
        );
      }

      // Atualiza distribuição de sentimento
      this.aggregates.sentimentDistribution[entry.analysis.sentiment.label]++;

      // Atualiza top issues
      entry.analysis.issues.forEach(issue => {
        const existing = this.aggregates.topIssues.find(i => i.issue === issue);
        if (existing) {
          existing.count++;
        } else {
          this.aggregates.topIssues.push({ issue, count: 1 });
        }
      });
      this.aggregates.topIssues.sort((a, b) => b.count - a.count);
      this.aggregates.topIssues = this.aggregates.topIssues.slice(0, 10);

      // Atualiza top praises
      entry.analysis.praises.forEach(praise => {
        const existing = this.aggregates.topPraises.find(p => p.praise === praise);
        if (existing) {
          existing.count++;
        } else {
          this.aggregates.topPraises.push({ praise, count: 1 });
        }
      });
      this.aggregates.topPraises.sort((a, b) => b.count - a.count);
      this.aggregates.topPraises = this.aggregates.topPraises.slice(0, 10);

      // Calcula NPS (Net Promoter Score)
      this._calculateNPS();
    }

    _calculateNPS() {
      const withRating = this.feedbacks.filter(f => f.rating !== undefined);
      if (withRating.length === 0) {
        this.aggregates.nps = 0;
        return;
      }

      const promoters = withRating.filter(f => f.rating >= 4.5).length;
      const detractors = withRating.filter(f => f.rating <= 2.5).length;
      
      this.aggregates.nps = Math.round(
        ((promoters - detractors) / withRating.length) * 100
      );
    }

    /**
     * Obtém análise agregada
     */
    getAnalysis() {
      return {
        ...this.aggregates,
        sentimentPercentages: {
          positive: this.aggregates.totalCount > 0 ? 
            (this.aggregates.sentimentDistribution.positive / this.aggregates.totalCount * 100).toFixed(1) : 0,
          neutral: this.aggregates.totalCount > 0 ? 
            (this.aggregates.sentimentDistribution.neutral / this.aggregates.totalCount * 100).toFixed(1) : 0,
          negative: this.aggregates.totalCount > 0 ? 
            (this.aggregates.sentimentDistribution.negative / this.aggregates.totalCount * 100).toFixed(1) : 0
        }
      };
    }

    /**
     * Busca feedbacks por critérios
     */
    search(criteria = {}) {
      return this.feedbacks.filter(f => {
        if (criteria.minRating && f.rating < criteria.minRating) return false;
        if (criteria.maxRating && f.rating > criteria.maxRating) return false;
        if (criteria.sentiment && f.analysis.sentiment.label !== criteria.sentiment) return false;
        if (criteria.category && f.analysis.category !== criteria.category) return false;
        if (criteria.keyword && !f.text.toLowerCase().includes(criteria.keyword.toLowerCase())) return false;
        if (criteria.since && f.createdAt < criteria.since) return false;
        if (criteria.until && f.createdAt > criteria.until) return false;
        return true;
      });
    }

    /**
     * Obtém tendências
     */
    getTrends(days = 7) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const recent = this.feedbacks.filter(f => f.createdAt >= cutoff);

      // Agrupa por dia
      const byDay = {};
      recent.forEach(f => {
        const day = new Date(f.createdAt).toISOString().split('T')[0];
        if (!byDay[day]) {
          byDay[day] = { count: 0, totalRating: 0, sentiments: { positive: 0, neutral: 0, negative: 0 } };
        }
        byDay[day].count++;
        if (f.rating) byDay[day].totalRating += f.rating;
        byDay[day].sentiments[f.analysis.sentiment.label]++;
      });

      return Object.entries(byDay).map(([day, data]) => ({
        day,
        count: data.count,
        avgRating: data.totalRating / data.count || 0,
        sentiments: data.sentiments
      })).sort((a, b) => a.day.localeCompare(b.day));
    }

    /**
     * Gera relatório
     */
    generateReport() {
      const analysis = this.getAnalysis();
      const trends = this.getTrends(30);

      return {
        summary: {
          totalFeedbacks: analysis.totalCount,
          averageRating: analysis.avgRating.toFixed(2),
          nps: analysis.nps,
          sentimentDistribution: analysis.sentimentPercentages
        },
        issues: analysis.topIssues.slice(0, 5),
        praises: analysis.topPraises.slice(0, 5),
        trends,
        generatedAt: new Date().toISOString()
      };
    }

    /**
     * Reseta dados
     */
    async reset() {
      this.feedbacks = [];
      this.aggregates = {
        totalCount: 0,
        avgRating: 0,
        sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
        topIssues: [],
        topPraises: [],
        nps: 0
      };
      await chrome.storage.local.remove(STORAGE_KEYS.FEEDBACK);
    }
  }

  // ============================================================
  // SMARTBOT EXTENDED - CLASSE PRINCIPAL INTEGRADORA
  // ============================================================
  class SmartBotExtended {
    constructor() {
      this.dialogManager = new DialogManager();
      this.entityManager = new EntityManager();
      this.intentManager = new IntentManager();
      this.humanAssistance = new HumanAssistanceSystem();
      this.cacheManager = new CacheManager({ maxSize: 500, defaultTTL: 300000 });
      this.rateLimitManager = new RateLimitManager();
      this.contextManager = new ContextManager({ defaultTTL: 1800000 });
      this.sessionManager = new SessionManager({ timeout: 1800000 });
      this.feedbackAnalyzer = new FeedbackAnalyzer();
      
      this.initialized = false;
      console.log('[SmartBot Extended] Sistemas carregados');
    }

    async init() {
      if (this.initialized) return;
      
      // Os managers carregam seus dados no construtor
      this.initialized = true;
      console.log('[SmartBot Extended] ✅ Inicializado');
    }

    /**
     * Processa mensagem completa com todos os sistemas
     */
    async processMessage(chatId, message, options = {}) {
      // Rate limiting
      const rateCheck = this.rateLimitManager.consume(`chat:${chatId}`);
      if (!rateCheck.allowed) {
        return {
          blocked: true,
          reason: 'rate_limited',
          retryAfter: rateCheck.retryAfter
        };
      }

      // Sessão
      const session = this.sessionManager.getOrCreate(chatId);
      this.sessionManager.touch(chatId);

      // Contexto
      this.contextManager.push(chatId, 'messages', {
        text: message.text || message.body,
        timestamp: Date.now(),
        from: message.from || 'user'
      }, 50);

      // Extração de entidades
      const entities = this.entityManager.extractAll(message.text || message.body || '');

      // Classificação de intenção
      const intentResult = this.intentManager.classify(
        message.text || message.body || '',
        {
          previousIntent: this.contextManager.get(chatId, 'lastIntent'),
          entities
        }
      );

      // Atualiza contexto
      this.contextManager.set(chatId, 'lastIntent', intentResult.intent);
      this.contextManager.set(chatId, 'lastEntities', entities);

      // Processa diálogo se ativo
      let dialogResult = null;
      if (this.dialogManager.getActiveSession(chatId)) {
        dialogResult = this.dialogManager.processInput(chatId, message.text || message.body, {
          intent: intentResult.intent,
          entities,
          sentiment: options.sentiment
        });
      }

      // Verifica se precisa escalar
      let escalationInfo = null;
      if (intentResult.intent === 'urgent' || 
          (options.sentiment !== undefined && options.sentiment < 0.3) ||
          intentResult.intent === 'complaint') {
        
        escalationInfo = this.humanAssistance.getQueuePosition(chatId);
        if (escalationInfo.status === 'not_found' && options.autoEscalate) {
          escalationInfo = this.humanAssistance.requestEscalation(chatId, {
            reason: intentResult.intent,
            sentiment: options.sentiment,
            intent: intentResult.intent,
            urgency: intentResult.intent === 'urgent' ? 1 : 0.5
          });
        }
      }

      return {
        chatId,
        intent: intentResult,
        entities,
        dialog: dialogResult,
        escalation: escalationInfo,
        session: {
          id: session.id,
          isNew: Date.now() - session.createdAt < 5000
        },
        context: this.contextManager.getContext(chatId)
      };
    }

    /**
     * Adiciona feedback
     */
    addFeedback(feedback) {
      return this.feedbackAnalyzer.addFeedback(feedback);
    }

    /**
     * Obtém relatório de feedback
     */
    getFeedbackReport() {
      return this.feedbackAnalyzer.generateReport();
    }

    /**
     * Obtém estatísticas gerais
     */
    getStats() {
      return {
        sessions: this.sessionManager.getStats(),
        cache: this.cacheManager.getStats(),
        rateLimit: this.rateLimitManager.getStats(),
        contexts: this.contextManager.getStats(),
        humanAssistance: this.humanAssistance.getQueueStatus(),
        feedback: this.feedbackAnalyzer.getAnalysis(),
        dialogs: {
          activeCount: this.dialogManager.getActiveDialogs().length,
          registeredCount: this.dialogManager.dialogs.size
        }
      };
    }

    /**
     * Exporta dados
     */
    exportData() {
      return {
        stats: this.getStats(),
        feedbackReport: this.getFeedbackReport(),
        exportedAt: new Date().toISOString()
      };
    }
  }

  // ============================================================
  // INICIALIZAÇÃO GLOBAL
  // ============================================================
  
  if (typeof window !== 'undefined') {
    // Exporta classes individuais
    window.DialogManager = DialogManager;
    window.EntityManager = EntityManager;
    window.IntentManager = IntentManager;
    window.HumanAssistanceSystem = HumanAssistanceSystem;
    window.CacheManager = CacheManager;
    window.RateLimitManager = RateLimitManager;
    window.ContextManager = ContextManager;
    window.SessionManager = SessionManager;
    window.FeedbackAnalyzer = FeedbackAnalyzer;
    
    // Exporta classe integradora
    window.SmartBotExtended = SmartBotExtended;
    
    // Cria instância global
    window.smartBotExtended = new SmartBotExtended();
    window.smartBotExtended.init();
    
    console.log('[SmartBot Extended] ✅ 9 sistemas adicionais carregados');
    
    // Cleanup ao descarregar
    window.addEventListener('beforeunload', () => {
      if (window.smartBotExtended) {
        // Cleanup de cada manager com interval
        if (window.smartBotExtended.cacheManager?.destroy) {
          window.smartBotExtended.cacheManager.destroy();
        }
        if (window.smartBotExtended.rateLimitManager?.destroy) {
          window.smartBotExtended.rateLimitManager.destroy();
        }
        if (window.smartBotExtended.feedbackAnalyzer?.destroy) {
          window.smartBotExtended.feedbackAnalyzer.destroy();
        }
      }
    });
  }

})();
