/**
 * 🎯 Confidence System - Sistema de Confiança e Copilot Mode
 * WhatsHybrid v7.6.0
 * 
 * Funcionalidades:
 * - Cálculo de score de confiança (0-100%)
 * - Níveis de confiança (Iniciante → Copiloto → Autônomo)
 * - Feedback de usuário (bom, ruim, correção)
 * - Registro de uso de sugestões
 * - Registro de envios automáticos
 * - Decisão de auto-send baseada em threshold
 * - Sincronização com backend
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'whl_confidence_system';
  const SCHEMA_VERSION = 2;

  // Schema esperado para validação
  const EXPECTED_SCHEMA = {
    schemaVersion: 'number',
    metrics: {
      feedbackGood: 'number',
      feedbackBad: 'number',
      feedbackCorrections: 'number',
      suggestionsUsed: 'number',
      suggestionsEdited: 'number',
      autoSent: 'number',
      faqsAdded: 'number',
      productsAdded: 'number',
      examplesAdded: 'number',
      totalInteractions: 'number'
    },
    score: 'number',
    level: 'string',
    copilotEnabled: 'boolean',
    threshold: 'number',
    lastUpdated: 'number'
  };

  // Níveis de confiança
  const CONFIDENCE_LEVELS = {
    autonomous: {
      threshold: 90,
      emoji: '🔵',
      label: 'Autônomo',
      description: 'IA responde automaticamente com alta confiança'
    },
    copilot: {
      threshold: 70,
      emoji: '🟢',
      label: 'Copiloto',
      description: 'IA pode responder casos simples automaticamente'
    },
    assisted: {
      threshold: 50,
      emoji: '🟡',
      label: 'Assistido',
      description: 'IA sugere respostas, você decide'
    },
    learning: {
      threshold: 30,
      emoji: '🟠',
      label: 'Aprendendo',
      description: 'IA em treinamento ativo'
    },
    beginner: {
      threshold: 0,
      emoji: '🔴',
      label: 'Iniciante',
      description: 'IA apenas sugere respostas básicas'
    }
  };

  // Configuração de pontos
  const POINTS_CONFIG = {
    feedback_good: 2.0,
    feedback_bad: -1.0,
    feedback_correction: 1.0,
    suggestion_used: 1.5,
    suggestion_edited: 0.5,
    auto_sent: 2.0,
    faq_added: 0.25,
    product_added: 0.1,
    example_added: 0.5
  };

  class ConfidenceSystem {
    constructor() {
      this.metrics = {
        feedbackGood: 0,
        feedbackBad: 0,
        feedbackCorrections: 0,
        suggestionsUsed: 0,
        suggestionsEdited: 0,
        autoSent: 0,
        faqsAdded: 0,
        productsAdded: 0,
        examplesAdded: 0,
        totalInteractions: 0
      };
      this.score = 0;
      this.level = 'beginner';
      this.copilotEnabled = false;
      this.threshold = 70; // Threshold padrão para copilot mode
      this.initialized = false;
      this.eventLog = []; // Histórico de eventos
    }

    /**
     * Valida o schema dos dados carregados
     * @param {Object} data - Dados a validar
     * @returns {Object} - { valid: boolean, errors: string[], fixed: Object }
     */
    _validateSchema(data) {
      const errors = [];
      const fixed = { ...data };

      // Verifica schemaVersion
      if (typeof fixed.schemaVersion !== 'number') {
        fixed.schemaVersion = 1; // Assume versão antiga
      }

      // Valida e corrige cada campo
      if (typeof fixed.score !== 'number' || isNaN(fixed.score)) {
        errors.push('score inválido');
        fixed.score = 0;
      }

      if (typeof fixed.level !== 'string' || !CONFIDENCE_LEVELS[fixed.level]) {
        errors.push('level inválido');
        fixed.level = 'beginner';
      }

      if (typeof fixed.copilotEnabled !== 'boolean') {
        fixed.copilotEnabled = false;
      }

      if (typeof fixed.threshold !== 'number' || fixed.threshold < 50 || fixed.threshold > 95) {
        errors.push('threshold inválido');
        fixed.threshold = 70;
      }

      // Valida metrics
      if (!fixed.metrics || typeof fixed.metrics !== 'object') {
        errors.push('metrics ausente');
        fixed.metrics = this._getDefaultMetrics();
      } else {
        const defaultMetrics = this._getDefaultMetrics();
        for (const key of Object.keys(defaultMetrics)) {
          if (typeof fixed.metrics[key] !== 'number' || isNaN(fixed.metrics[key])) {
            errors.push(`metrics.${key} inválido`);
            fixed.metrics[key] = defaultMetrics[key];
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        fixed
      };
    }

    /**
     * Retorna métricas padrão
     */
    _getDefaultMetrics() {
      return {
        feedbackGood: 0,
        feedbackBad: 0,
        feedbackCorrections: 0,
        suggestionsUsed: 0,
        suggestionsEdited: 0,
        autoSent: 0,
        faqsAdded: 0,
        productsAdded: 0,
        examplesAdded: 0,
        totalInteractions: 0
      };
    }

    /**
     * Migra dados de versões anteriores
     * @param {Object} data - Dados a migrar
     * @returns {Object} - Dados migrados
     */
    _migrateData(data) {
      const version = data.schemaVersion || 1;
      let migrated = { ...data };

      // Migração v1 -> v2
      if (version < 2) {
        console.log('[ConfidenceSystem] Migrando dados v1 -> v2');
        
        // v2 adiciona campos extras
        if (!migrated.metrics.examplesAdded) {
          migrated.metrics.examplesAdded = 0;
        }
        
        // Normaliza valores
        migrated.score = Math.min(100, Math.max(0, migrated.score || 0));
        
        migrated.schemaVersion = 2;
      }

      // Futuras migrações aqui...

      return migrated;
    }

    /**
     * Inicializa e carrega dados do storage com validação de schema
     */
    async init() {
      if (this.initialized) return;

      try {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        if (data[STORAGE_KEY]) {
          // Parse de dados (compatibilidade string/objeto)
          let stored = data[STORAGE_KEY];
          if (typeof stored === 'string') {
            try {
              stored = JSON.parse(stored);
            } catch (parseError) {
              console.error('[ConfidenceSystem] Erro ao fazer parse dos dados:', parseError);
              stored = {};
            }
          }

          // Valida schema
          const validation = this._validateSchema(stored);
          if (!validation.valid) {
            console.warn('[ConfidenceSystem] Schema inválido, corrigindo:', validation.errors);
          }

          // Migra se necessário
          let finalData = validation.fixed;
          if (finalData.schemaVersion < SCHEMA_VERSION) {
            finalData = this._migrateData(finalData);
            // Salva dados migrados
            await this.save();
          }

          // Aplica dados validados
          this.metrics = finalData.metrics;
          this.score = finalData.score;
          this.level = finalData.level;
          this.copilotEnabled = finalData.copilotEnabled;
          this.threshold = finalData.threshold;
          
          console.log('[ConfidenceSystem] Dados carregados (schema v' + finalData.schemaVersion + '):', { 
            score: this.score, 
            level: this.level 
          });
        }
        
        // Carrega log de eventos
        await this.loadEventLog();
        
        this.initialized = true;
      } catch (error) {
        console.error('[ConfidenceSystem] Erro ao inicializar:', error);
      }
    }

    /**
     * Salva dados no storage com schema version
     */
    async save() {
      try {
        const data = {
          schemaVersion: SCHEMA_VERSION,
          metrics: this.metrics,
          score: this.score,
          level: this.level,
          copilotEnabled: this.copilotEnabled,
          threshold: this.threshold,
          lastUpdated: Date.now()
        };

        // Sempre serializa como JSON para consistência
        await chrome.storage.local.set({
          [STORAGE_KEY]: JSON.stringify(data)
        });

        console.log('[ConfidenceSystem] Dados salvos (schema v' + SCHEMA_VERSION + ')');
        return true;
      } catch (error) {
        console.error('[ConfidenceSystem] Erro ao salvar:', error);
        return false;
      }
    }

    /**
     * Calcula score de confiança baseado em métricas PONDERADAS
     * 
     * Componentes:
     * - Feedback Score: max 40 pontos (ratio good/total)
     * - Knowledge Score: max 20 pontos (weighted FAQs, products, examples)
     * - Usage Score: max 25 pontos (ratio used/total)
     * - Auto-Send Score: max 15 pontos (capped)
     * 
     * @returns {number} - Score (0-100)
     */
    calculateScore() {
      // 1. Feedback Score (max 40 pontos)
      const totalFeedback = this.metrics.feedbackGood + this.metrics.feedbackBad;
      let feedbackScore = 0;
      if (totalFeedback > 0) {
        feedbackScore = (this.metrics.feedbackGood / totalFeedback) * 40;
      }

      // 2. Knowledge Base Score (max 20 pontos)
      const knowledgeScore = Math.min(20,
        (this.metrics.faqsAdded * 0.5) +
        (this.metrics.productsAdded * 0.3) +
        (this.metrics.examplesAdded * 1.0)
      );

      // 3. Usage Score (max 25 pontos)
      const totalSuggestions = this.metrics.suggestionsUsed + this.metrics.suggestionsEdited;
      let usageScore = 0;
      if (totalSuggestions > 0) {
        usageScore = (this.metrics.suggestionsUsed / totalSuggestions) * 25;
      }

      // 4. Auto-Send Score (max 15 pontos)
      const autoScore = Math.min(15, this.metrics.autoSent * 0.5);

      // Total (max 100)
      this.score = Math.min(100, Math.round(feedbackScore + knowledgeScore + usageScore + autoScore));

      // Atualiza nível
      this.updateLevel();

      return this.score;
    }

    /**
     * Atualiza nível baseado no score
     */
    updateLevel() {
      const oldLevel = this.level;

      if (this.score >= CONFIDENCE_LEVELS.autonomous.threshold) {
        this.level = 'autonomous';
      } else if (this.score >= CONFIDENCE_LEVELS.copilot.threshold) {
        this.level = 'copilot';
      } else if (this.score >= CONFIDENCE_LEVELS.assisted.threshold) {
        this.level = 'assisted';
      } else if (this.score >= CONFIDENCE_LEVELS.learning.threshold) {
        this.level = 'learning';
      } else {
        this.level = 'beginner';
      }

      if (oldLevel !== this.level) {
        console.log(`[ConfidenceSystem] Nível atualizado: ${oldLevel} → ${this.level}`);
        
        // Emite evento
        if (window.EventBus) {
          window.EventBus.emit('confidence:level-changed', {
            oldLevel,
            newLevel: this.level,
            score: this.score
          });
        }
      }
    }

    /**
     * Obtém nível de confiança atual
     * @returns {Object} - { level, emoji, label, description, threshold, score }
     */
    getConfidenceLevel() {
      const levelData = CONFIDENCE_LEVELS[this.level];
      return {
        level: this.level,
        emoji: levelData.emoji,
        label: levelData.label,
        description: levelData.description,
        threshold: levelData.threshold,
        score: this.score
      };
    }

    /**
     * Retorna o score atual (compatibilidade com módulos que esperam getScore()).
     */
    getScore() {
      return this.score || 0;
    }

    /**
     * Envia feedback de confiança
     * @param {string} type - Tipo: 'good', 'bad', 'correction'
     * @param {Object} metadata - Metadados adicionais
     */
    async sendConfidenceFeedback(type, metadata = {}) {
      this.metrics.totalInteractions++;

      if (type === 'good') {
        this.metrics.feedbackGood++;
      } else if (type === 'bad') {
        this.metrics.feedbackBad++;
      } else if (type === 'correction') {
        this.metrics.feedbackCorrections++;
      }

      this.calculateScore();
      await this.save();

      console.log('[ConfidenceSystem] Feedback registrado:', type, 'Score:', this.score);

      // Envia para backend
      this.pushToBackend('feedback', { type, metadata });

      // Emite evento
      if (window.EventBus) {
        window.EventBus.emit('confidence:feedback', {
          type,
          score: this.score,
          level: this.level,
          metadata
        });
      }
    }

    /**
     * Registra uso de sugestão
     * @param {boolean} edited - Se a sugestão foi editada
     * @param {Object} metadata - Metadados
     */
    async recordSuggestionUsage(edited, metadata = {}) {
      if (edited) {
        this.metrics.suggestionsEdited++;
      } else {
        this.metrics.suggestionsUsed++;
      }

      this.metrics.totalInteractions++;
      this.calculateScore();
      await this.save();

      console.log('[ConfidenceSystem] Uso de sugestão registrado. Editada:', edited);

      // Envia para backend
      this.pushToBackend('suggestion_usage', { edited, metadata });
    }

    /**
     * Registra envio automático
     * @param {Object} metadata - Metadados
     */
    async recordAutoSend(metadata = {}) {
      this.metrics.autoSent++;
      this.metrics.totalInteractions++;
      this.calculateScore();
      await this.save();

      console.log('[ConfidenceSystem] Auto-send registrado. Total:', this.metrics.autoSent);

      // Envia para backend
      this.pushToBackend('auto_send', { metadata });
    }

    /**
     * Registra adição de FAQ
     */
    async recordFAQAdded() {
      this.metrics.faqsAdded++;
      this.calculateScore();
      await this.save();
    }

    /**
     * Registra adição de produto
     */
    async recordProductAdded() {
      this.metrics.productsAdded++;
      this.calculateScore();
      await this.save();
    }

    /**
     * Registra adição de exemplo
     */
    async recordExampleAdded() {
      this.metrics.examplesAdded++;
      this.calculateScore();
      await this.save();
    }

    /**
     * Verifica se pode enviar automaticamente
     * @param {Object} message - Mensagem a ser enviada
     * @param {string} chatTitle - Título do chat
     * @returns {boolean} - Pode enviar?
     */
    canAutoSend(message = null, chatTitle = '') {
      // Verifica se copilot está ativado
      if (!this.copilotEnabled) {
        return false;
      }

      // Verifica se score atinge threshold
      if (this.score < this.threshold) {
        return false;
      }

      // Verificações adicionais podem ser feitas aqui
      // Ex: horário, tipo de mensagem, histórico do chat, etc.

      return true;
    }

    /**
     * Ativa/desativa copilot mode
     * @param {boolean} enabled - Ativar?
     */
    async toggleCopilot(enabled) {
      this.copilotEnabled = enabled;
      await this.save();

      console.log('[ConfidenceSystem] Copilot mode:', enabled ? 'ativado' : 'desativado');

      // Emite evento
      if (window.EventBus) {
        window.EventBus.emit('confidence:copilot-toggled', {
          enabled,
          score: this.score,
          level: this.level
        });
      }

      // Envia para backend
      this.pushToBackend('copilot_toggle', { enabled });
    }

    /**
     * Define threshold do copilot
     * @param {number} threshold - Threshold (50-95)
     */
    async setThreshold(threshold) {
      this.threshold = Math.max(50, Math.min(95, threshold));
      await this.save();

      console.log('[ConfidenceSystem] Threshold atualizado:', this.threshold);

      // Emite evento
      if (window.EventBus) {
        window.EventBus.emit('confidence:threshold-changed', {
          threshold: this.threshold,
          score: this.score
        });
      }
    }

    /**
     * Verifica se pode enviar automaticamente baseado em análise da mensagem
     * Baseado em CERTO-WHATSAPPLITE-main-21/05chromeextensionwhatsapp/content/content.js
     * 
     * @param {string} message - Mensagem recebida
     * @param {Object} knowledge - Base de conhecimento
     * @returns {Object} - { canSend, reason, confidence, answer }
     */
    async canAutoSendSmart(message, knowledge = null) {
      try {
        // Verifica se copilot está ativado e score atinge threshold
        if (!this.copilotEnabled) {
          return { canSend: false, reason: 'copilot_disabled' };
        }

        if (this.score < this.threshold) {
          return { canSend: false, reason: 'below_threshold', score: this.score, threshold: this.threshold };
        }

        // Carrega knowledge se não fornecido
        if (!knowledge && window.knowledgeBase) {
          knowledge = await window.knowledgeBase.getKnowledge();
        }

        if (!knowledge) {
          return { canSend: false, reason: 'no_knowledge_base' };
        }

        // 1. Simple greetings (confiança 95%)
        if (this.isSimpleGreeting(message)) {
          return { 
            canSend: true, 
            reason: 'greeting', 
            confidence: 95,
            answer: null // Será gerado pela IA
          };
        }

        // 2. FAQ match (confiança > 80%)
        const faqMatch = this.findFAQMatch(message, knowledge.faq || []);
        if (faqMatch && faqMatch.confidence > 80) {
          return { 
            canSend: true, 
            reason: 'faq_match', 
            confidence: faqMatch.confidence, 
            answer: faqMatch.answer 
          };
        }

        // 3. Canned reply match (confiança 90%)
        const cannedMatch = this.checkCannedReply(message, knowledge.cannedReplies || []);
        if (cannedMatch) {
          return { 
            canSend: true, 
            reason: 'canned_reply', 
            confidence: 90, 
            answer: cannedMatch 
          };
        }

        // 4. Product match (confiança > 75%)
        const productMatch = this.findProductMatch(message, knowledge.products || []);
        if (productMatch && productMatch.confidence > 75) {
          return { 
            canSend: true, 
            reason: 'product_match', 
            confidence: productMatch.confidence,
            product: productMatch.product,
            answer: null // Será gerado pela IA com contexto do produto
          };
        }

        // 5. Conversa complexa - modo assistido
        return { canSend: false, reason: 'complex_conversation' };

      } catch (error) {
        console.error('[ConfidenceSystem] Erro em canAutoSendSmart:', error);
        return { canSend: false, reason: 'error', error: error.message };
      }
    }

    /**
     * Detecta saudações simples
     * 
     * NOTE: Esta implementação é intencionalmente duplicada em text-monitor.js
     * para manter a independência dos módulos. Cada módulo tem suas próprias
     * necessidades e contextos de uso.
     * 
     * @param {string} message - Mensagem
     * @returns {boolean}
     */
    isSimpleGreeting(message) {
      const greetings = [
        'oi', 'olá', 'ola', 'oie', 'oii', 'oiii',
        'bom dia', 'boa tarde', 'boa noite',
        'eae', 'eai', 'fala', 'salve',
        'hey', 'hi', 'hello',
        'opa', 'opaa', 'e aí', 'e ai',
        'blz', 'beleza', 'td bem', 'tudo bem'
      ];
      
      const normalized = (message || '').toLowerCase().trim();
      
      // Match exato ou começa com saudação + separador
      return greetings.some(g => {
        if (normalized === g) return true;
        if (normalized.startsWith(g)) {
          const nextChar = normalized.charAt(g.length);
          return /[\s,!?.]/.test(nextChar);
        }
        return false;
      });
    }

    /**
     * Busca match com FAQs usando similaridade de palavras
     * @param {string} message - Mensagem
     * @param {Array} faqs - Lista de FAQs
     * @returns {Object|null} - { answer, confidence }
     */
    findFAQMatch(message, faqs) {
      if (!Array.isArray(faqs) || faqs.length === 0) return null;
      
      const normalized = (message || '').toLowerCase().trim();
      const words = normalized.split(/\s+/).filter(w => w.length > 2);
      
      if (words.length === 0) return null;
      
      let bestMatch = null;
      let bestConfidence = 0;
      
      for (const faq of faqs) {
        if (!faq.question || !faq.answer) continue;
        
        const questionWords = faq.question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        
        if (questionWords.length === 0) continue;
        
        // Conta palavras que fazem match
        const matches = questionWords.filter(qw => 
          words.some(w => w.includes(qw) || qw.includes(w))
        );
        
        const confidence = Math.round((matches.length / questionWords.length) * 100);
        
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = {
            question: faq.question,
            answer: faq.answer,
            confidence
          };
        }
      }
      
      return bestMatch;
    }

    /**
     * Verifica match com respostas rápidas (canned replies)
     * 
     * NOTE: Esta implementação é intencionalmente duplicada em knowledge-base.js
     * para manter a independência dos módulos. ConfidenceSystem precisa desta
     * funcionalidade para suas próprias análises sem depender de KnowledgeBase.
     * 
     * @param {string} message - Mensagem
     * @param {Array} cannedReplies - Lista de respostas rápidas
     * @returns {string|null} - Resposta ou null
     */
    checkCannedReply(message, cannedReplies) {
      if (!Array.isArray(cannedReplies) || cannedReplies.length === 0) return null;
      
      const normalized = (message || '').toLowerCase().trim();
      
      for (const canned of cannedReplies) {
        if (!canned.triggers || !canned.reply) continue;
        
        const triggers = Array.isArray(canned.triggers) ? canned.triggers : [canned.triggers];
        
        for (const trigger of triggers) {
          const triggerLower = (trigger || '').toLowerCase();
          if (triggerLower && (normalized === triggerLower || normalized.includes(triggerLower))) {
            return canned.reply;
          }
        }
      }
      
      return null;
    }

    /**
     * Busca match com produtos
     * @param {string} message - Mensagem
     * @param {Array} products - Lista de produtos
     * @returns {Object|null} - { product, confidence }
     */
    findProductMatch(message, products) {
      if (!Array.isArray(products) || products.length === 0) return null;
      
      const normalized = (message || '').toLowerCase().trim();
      const words = normalized.split(/\s+/).filter(w => w.length > 2);
      
      if (words.length === 0) return null;
      
      let bestMatch = null;
      let bestConfidence = 0;
      
      for (const product of products) {
        if (!product.name) continue;
        
        const productName = product.name.toLowerCase();
        const productWords = productName.split(/\s+/).filter(w => w.length > 2);
        
        // Verifica se nome do produto está na mensagem
        if (normalized.includes(productName)) {
          return { product, confidence: 95 };
        }
        
        // Conta palavras que fazem match
        const matches = productWords.filter(pw => 
          words.some(w => w.includes(pw) || pw.includes(w))
        );
        
        if (productWords.length > 0) {
          const confidence = Math.round((matches.length / productWords.length) * 100);
          
          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestMatch = { product, confidence };
          }
        }
      }
      
      return bestMatch;
    }

    /**
     * Adiciona histórico de eventos de confiança
     */
    logEvent(action, points, metadata = {}) {
      if (!this.eventLog) {
        this.eventLog = [];
      }
      
      this.eventLog.push({
        action,
        points,
        metadata,
        score: this.score,
        level: this.level,
        timestamp: Date.now()
      });
      
      // Mantém últimos 500 eventos
      if (this.eventLog.length > 500) {
        this.eventLog = this.eventLog.slice(-500);
      }
    }

    /**
     * Envia dados para backend
     * @param {string} eventType - Tipo do evento
     * @param {Object} data - Dados
     */
    pushToBackend(eventType, data) {
      try {
        const event = {
          type: eventType,
          data,
          score: this.score,
          level: this.level,
          timestamp: Date.now()
        };

        chrome.runtime.sendMessage({
          action: 'UPDATE_CONFIDENCE',
          event
        }).catch(err => {
          console.warn('[ConfidenceSystem] Erro ao enviar para backend:', err);
        });

      } catch (error) {
        console.error('[ConfidenceSystem] Erro ao fazer push:', error);
      }
    }

    /**
     * Obtém métricas
     * @returns {Object} - Métricas
     */
    getMetrics() {
      return {
        ...this.metrics,
        score: this.score,
        level: this.level,
        copilotEnabled: this.copilotEnabled,
        threshold: this.threshold
      };
    }

    /**
     * Calcula pontos faltantes para próximo nível
     * @returns {Object} - { nextLevel, pointsNeeded, scoreNeeded }
     */
    getPointsToNextLevel() {
      const levels = ['beginner', 'learning', 'assisted', 'copilot', 'autonomous'];
      const currentIndex = levels.indexOf(this.level);
      
      if (currentIndex === levels.length - 1) {
        return {
          nextLevel: 'autonomous',
          pointsNeeded: 0,
          scoreNeeded: 0,
          message: 'Nível máximo alcançado!'
        };
      }

      const nextLevel = levels[currentIndex + 1];
      const nextThreshold = CONFIDENCE_LEVELS[nextLevel].threshold;
      const scoreNeeded = nextThreshold - this.score;

      return {
        nextLevel: CONFIDENCE_LEVELS[nextLevel].label,
        pointsNeeded: scoreNeeded,
        scoreNeeded,
        currentScore: this.score,
        nextThreshold,
        message: `Faltam ${scoreNeeded} pontos para ${CONFIDENCE_LEVELS[nextLevel].label}`
      };
    }

    /**
     * Reseta métricas (manter apenas conhecimento)
     */
    async resetMetrics() {
      this.metrics = {
        feedbackGood: 0,
        feedbackBad: 0,
        feedbackCorrections: 0,
        suggestionsUsed: 0,
        suggestionsEdited: 0,
        autoSent: 0,
        faqsAdded: this.metrics.faqsAdded, // Mantém conhecimento
        productsAdded: this.metrics.productsAdded,
        examplesAdded: this.metrics.examplesAdded,
        totalInteractions: 0
      };
      
      this.calculateScore();
      await this.save();
      console.log('[ConfidenceSystem] Métricas resetadas');
    }

    /**
     * Obtém estatísticas formatadas
     * @returns {Object} - Estatísticas
     */
    getStats() {
      const total = this.metrics.feedbackGood + this.metrics.feedbackBad;
      const accuracy = total > 0 
        ? Math.round((this.metrics.feedbackGood / total) * 100) 
        : 0;

      return {
        score: this.score,
        level: this.getConfidenceLevel(),
        accuracy: `${accuracy}%`,
        feedbackGood: this.metrics.feedbackGood,
        feedbackBad: this.metrics.feedbackBad,
        corrections: this.metrics.feedbackCorrections,
        suggestionsUsed: this.metrics.suggestionsUsed,
        autoSent: this.metrics.autoSent,
        knowledgeBase: {
          faqs: this.metrics.faqsAdded,
          products: this.metrics.productsAdded,
          examples: this.metrics.examplesAdded
        },
        totalInteractions: this.metrics.totalInteractions
      };
    }

    /**
     * Registra evento no log persistente (max 1000 eventos)
     * @param {string} eventType - Tipo do evento
     * @param {Object} data - Dados do evento
     */
    logEvent(eventType, data = {}) {
      const event = {
        type: eventType,
        data,
        timestamp: Date.now(),
        score: this.score,
        level: this.level
      };

      // Adiciona ao log
      this.eventLog.push(event);

      // Limita a 1000 eventos
      if (this.eventLog.length > 1000) {
        this.eventLog = this.eventLog.slice(-1000);
      }

      // Persiste no storage
      this.saveEventLog();

      console.log('[ConfidenceSystem] Evento registrado:', eventType);
    }

    /**
     * Salva log de eventos no storage
     */
    async saveEventLog() {
      try {
        await chrome.storage.local.set({
          'whl_confidence_event_log': JSON.stringify(this.eventLog)
        });
      } catch (error) {
        console.warn('[ConfidenceSystem] Erro ao salvar log de eventos:', error);
      }
    }

    /**
     * Carrega log de eventos do storage
     */
    async loadEventLog() {
      try {
        const data = await chrome.storage.local.get('whl_confidence_event_log');
        if (data['whl_confidence_event_log']) {
          this.eventLog = JSON.parse(data['whl_confidence_event_log']);
          console.log('[ConfidenceSystem] Log de eventos carregado:', this.eventLog.length);
        }
      } catch (error) {
        console.warn('[ConfidenceSystem] Erro ao carregar log de eventos:', error);
      }
    }

    /**
     * Obtém eventos do log com filtro opcional
     * @param {string} eventType - Tipo de evento para filtrar (opcional)
     * @param {number} limit - Limite de eventos (padrão: 100)
     * @returns {Array} - Lista de eventos
     */
    getEventLog(eventType = null, limit = 100) {
      let events = this.eventLog;
      
      if (eventType) {
        events = events.filter(e => e.type === eventType);
      }
      
      return events.slice(-limit);
    }
  }

  // Exporta globalmente
  window.ConfidenceSystem = ConfidenceSystem;

  // Cria instância global
  if (!window.confidenceSystem) {
    window.confidenceSystem = new ConfidenceSystem();
    window.confidenceSystem.init().then(() => {
      console.log('[ConfidenceSystem] ✅ Módulo carregado e inicializado');
    });
  }

})();
