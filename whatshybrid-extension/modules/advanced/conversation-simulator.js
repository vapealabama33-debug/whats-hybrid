/**
 * ADV-008: Conversation Simulator - Simulador de conversas para testes
 * 
 * @version 1.0.0
 * @since 7.9.14
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'whl_conversation_simulator',
    MAX_SCENARIOS: 50,
    MAX_SIMULATION_TURNS: 20
  };

  const PERSONA_TEMPLATES = {
    curious: {
      name: 'Cliente Curioso',
      traits: ['pergunta muito', 'quer detalhes', 'compara opções'],
      responsePatterns: [
        'E como funciona {topic}?',
        'Qual a diferença entre {optionA} e {optionB}?',
        'Pode me explicar melhor?'
      ]
    },
    impatient: {
      name: 'Cliente Impaciente',
      traits: ['mensagens curtas', 'quer rapidez', 'demonstra frustração'],
      responsePatterns: [
        'Rápido, preciso de {need}',
        'Quanto tempo demora?',
        'Já esperei muito!'
      ]
    },
    indecisive: {
      name: 'Cliente Indeciso',
      traits: ['muda de ideia', 'pede opiniões', 'hesitante'],
      responsePatterns: [
        'Não sei se devo...',
        'O que você recomenda?',
        'Deixa eu pensar...'
      ]
    },
    technical: {
      name: 'Cliente Técnico',
      traits: ['usa termos técnicos', 'preciso', 'analítico'],
      responsePatterns: [
        'Quais são as especificações de {product}?',
        'Qual a compatibilidade com {system}?',
        'Preciso de dados técnicos'
      ]
    },
    friendly: {
      name: 'Cliente Amigável',
      traits: ['usa emojis', 'conversa casual', 'agradece'],
      responsePatterns: [
        'Oi! Tudo bem? 😊',
        'Muito obrigado pela ajuda!',
        'Vocês são ótimos!'
      ]
    }
  };

  class ConversationSimulator {
    constructor() {
      this.scenarios = [];
      this.simulations = [];
      this.currentSimulation = null;
      this.initialized = false;
    }

    async init() {
      await this._loadData();
      this.initialized = true;
      console.log('[Simulator] Initialized');
    }

    async _loadData() {
      try {
        const data = await this._getStorage(CONFIG.STORAGE_KEY);
        if (data) {
          this.scenarios = data.scenarios || [];
          this.simulations = data.simulations || [];
        }
      } catch (e) {
        console.warn('[Simulator] Load failed:', e);
      }
    }

    async _saveData() {
      await this._setStorage(CONFIG.STORAGE_KEY, {
        scenarios: this.scenarios.slice(-CONFIG.MAX_SCENARIOS),
        simulations: this.simulations.slice(-100)
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
     * Cria um cenário de simulação
     */
    createScenario(config) {
      const scenario = {
        id: `scen_${Date.now()}`,
        name: config.name || 'Novo Cenário',
        description: config.description || '',
        persona: config.persona || 'curious',
        initialMessage: config.initialMessage || 'Olá!',
        goals: config.goals || [],
        expectedOutcome: config.expectedOutcome || 'resolved',
        difficulty: config.difficulty || 'medium',
        context: config.context || {},
        createdAt: Date.now()
      };

      this.scenarios.push(scenario);
      this._saveData();
      return scenario;
    }

    /**
     * Inicia uma simulação
     */
    startSimulation(scenarioId) {
      const scenario = this.scenarios.find(s => s.id === scenarioId);
      if (!scenario) throw new Error('Scenario not found');

      this.currentSimulation = {
        id: `sim_${Date.now()}`,
        scenarioId,
        scenario,
        messages: [],
        currentTurn: 0,
        startedAt: Date.now(),
        status: 'in_progress',
        metrics: {
          responseQuality: [],
          responseTime: [],
          goalsAchieved: []
        }
      };

      // Adicionar mensagem inicial
      this._addSimulationMessage('customer', scenario.initialMessage);

      return this.currentSimulation;
    }

    _addSimulationMessage(role, content, metadata = {}) {
      if (!this.currentSimulation) return;

      this.currentSimulation.messages.push({
        role,
        content,
        timestamp: Date.now(),
        ...metadata
      });
      this.currentSimulation.currentTurn++;
    }

    /**
     * Processa resposta na simulação
     */
    async processResponse(aiResponse) {
      if (!this.currentSimulation) throw new Error('No active simulation');
      if (this.currentSimulation.currentTurn >= CONFIG.MAX_SIMULATION_TURNS) {
        return this.endSimulation('max_turns_reached');
      }

      // Registrar resposta da IA
      this._addSimulationMessage('assistant', aiResponse, {
        confidence: aiResponse.confidence,
        source: aiResponse.source
      });

      // Avaliar resposta
      const evaluation = this._evaluateResponse(aiResponse);
      this.currentSimulation.metrics.responseQuality.push(evaluation.score);

      // Verificar objetivos
      this._checkGoals(aiResponse);

      // Gerar próxima mensagem do cliente simulado
      const nextMessage = await this._generateCustomerResponse(aiResponse);
      
      if (nextMessage.endConversation) {
        return this.endSimulation(nextMessage.reason);
      }

      this._addSimulationMessage('customer', nextMessage.content);

      return {
        evaluation,
        nextMessage: nextMessage.content,
        status: this.currentSimulation.status
      };
    }

    _evaluateResponse(response) {
      let score = 0.5;
      const feedback = [];

      // Verificar comprimento
      if (response.content?.length > 20 && response.content?.length < 500) {
        score += 0.1;
        feedback.push('Comprimento adequado');
      }

      // Verificar se responde à pergunta
      const lastCustomerMessage = this.currentSimulation.messages
        .filter(m => m.role === 'customer')
        .slice(-1)[0];
      
      if (lastCustomerMessage && this._isRelevant(response.content, lastCustomerMessage.content)) {
        score += 0.2;
        feedback.push('Relevante para a pergunta');
      }

      // Verificar tom
      const persona = PERSONA_TEMPLATES[this.currentSimulation.scenario.persona];
      if (persona && this._matchesTone(response.content, persona.traits)) {
        score += 0.2;
        feedback.push('Tom adequado à persona');
      }

      return { score: Math.min(1, score), feedback };
    }

    _isRelevant(response, question) {
      const qWords = new Set(question.toLowerCase().split(/\s+/));
      const rWords = response.toLowerCase().split(/\s+/);
      const overlap = rWords.filter(w => qWords.has(w)).length;
      return overlap >= 2;
    }

    _matchesTone(response, traits) {
      // Verificação simplificada de tom
      const isPolite = /obrigad|desculpe|por favor/i.test(response);
      const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(response);
      
      if (traits.includes('usa emojis') && hasEmoji) return true;
      if (traits.includes('técnico') && /especificaç|compatib|configur/i.test(response)) return true;
      return isPolite;
    }

    _checkGoals(response) {
      const goals = this.currentSimulation.scenario.goals;
      
      for (const goal of goals) {
        if (this.currentSimulation.metrics.goalsAchieved.includes(goal.id)) continue;
        
        if (goal.type === 'keyword' && response.content?.toLowerCase().includes(goal.value.toLowerCase())) {
          this.currentSimulation.metrics.goalsAchieved.push(goal.id);
        }
        if (goal.type === 'sentiment' && response.sentiment >= goal.value) {
          this.currentSimulation.metrics.goalsAchieved.push(goal.id);
        }
      }
    }

    async _generateCustomerResponse(aiResponse) {
      const persona = PERSONA_TEMPLATES[this.currentSimulation.scenario.persona];
      const turnCount = this.currentSimulation.currentTurn;

      // Verificar se deve encerrar
      if (turnCount > 10 || this._shouldEndConversation()) {
        return {
          endConversation: true,
          reason: 'conversation_complete',
          content: this._getClosingMessage(persona)
        };
      }

      // Gerar resposta baseada na persona
      const patterns = persona.responsePatterns;
      const template = patterns[Math.floor(Math.random() * patterns.length)];
      const content = this._fillTemplate(template);

      return { content, endConversation: false };
    }

    _shouldEndConversation() {
      const metrics = this.currentSimulation.metrics;
      const avgQuality = metrics.responseQuality.reduce((a, b) => a + b, 0) / 
                        (metrics.responseQuality.length || 1);
      
      const goalsComplete = metrics.goalsAchieved.length >= 
                           this.currentSimulation.scenario.goals.length;
      
      return avgQuality > 0.8 && goalsComplete;
    }

    _getClosingMessage(persona) {
      const closings = {
        curious: 'Entendi tudo! Muito obrigado pelas explicações.',
        impatient: 'Ok, obrigado.',
        indecisive: 'Vou pensar e volto depois, obrigado!',
        technical: 'Perfeito, as informações estão completas. Obrigado.',
        friendly: 'Muito obrigado pela ajuda! Vocês são demais! 🙏😊'
      };
      return closings[this.currentSimulation.scenario.persona] || 'Obrigado!';
    }

    _fillTemplate(template) {
      return template
        .replace('{topic}', 'esse produto')
        .replace('{optionA}', 'a opção básica')
        .replace('{optionB}', 'a opção premium')
        .replace('{need}', 'uma resposta')
        .replace('{product}', 'o produto')
        .replace('{system}', 'meu sistema');
    }

    /**
     * Encerra simulação
     */
    endSimulation(reason = 'manual') {
      if (!this.currentSimulation) return null;

      const metrics = this.currentSimulation.metrics;
      
      this.currentSimulation.status = 'completed';
      this.currentSimulation.endedAt = Date.now();
      this.currentSimulation.endReason = reason;
      this.currentSimulation.summary = {
        turns: this.currentSimulation.currentTurn,
        duration: Date.now() - this.currentSimulation.startedAt,
        avgQuality: metrics.responseQuality.length > 0
          ? metrics.responseQuality.reduce((a, b) => a + b, 0) / metrics.responseQuality.length
          : 0,
        goalsAchieved: metrics.goalsAchieved.length,
        totalGoals: this.currentSimulation.scenario.goals.length
      };

      this.simulations.push(this.currentSimulation);
      const result = this.currentSimulation;
      this.currentSimulation = null;
      
      this._saveData();
      return result;
    }

    listScenarios() {
      return this.scenarios.map(s => ({
        id: s.id,
        name: s.name,
        persona: s.persona,
        difficulty: s.difficulty
      }));
    }

    getSimulationHistory(limit = 20) {
      return this.simulations.slice(-limit).reverse();
    }

    getStats() {
      const completed = this.simulations.filter(s => s.status === 'completed');
      return {
        totalScenarios: this.scenarios.length,
        totalSimulations: this.simulations.length,
        avgQuality: completed.length > 0
          ? (completed.reduce((s, sim) => s + sim.summary.avgQuality, 0) / completed.length).toFixed(2)
          : 'N/A'
      };
    }
  }

  const simulator = new ConversationSimulator();
  simulator.init();

  window.WHLConversationSimulator = simulator;
  window.WHLPersonaTemplates = PERSONA_TEMPLATES;
  console.log('[ADV-008] Conversation Simulator initialized');

})();
