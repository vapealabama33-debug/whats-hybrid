/**
 * ADV-001: Multi-Agent System - Sistema de múltiplos agentes especializados
 * 
 * TODO: AUDIT-NEW-018 (P3) - i18n AI Prompts
 * This module has hardcoded Portuguese agent prompts.
 * See: docs/internal/PEND-MED-003-I18N-AI-PROMPTS-FIX.md for full implementation guide.
 * Lines affected: 22-43 (AGENTS definitions)
 * 
 * @version 1.0.0
 * @since 7.9.14
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'whl_multi_agent',
    MAX_AGENTS: 10,
    ROUTER_MODEL: 'gpt-4o-mini'
  };

  const DEFAULT_AGENTS = {
    router: {
      id: 'router',
      name: 'Roteador',
      role: 'Determina qual agente deve responder',
      systemPrompt: 'Analise a mensagem e determine qual agente especialista deve responder.',
      isSystem: true
    },
    sales: {
      id: 'sales',
      name: 'Vendas',
      role: 'Especialista em vendas e conversão',
      systemPrompt: 'Você é um especialista em vendas. Foque em conversão e valor.',
      triggers: ['preço', 'comprar', 'desconto', 'promoção']
    },
    support: {
      id: 'support',
      name: 'Suporte',
      role: 'Suporte técnico e resolução de problemas',
      systemPrompt: 'Você é um especialista em suporte técnico. Seja detalhado e paciente.',
      triggers: ['problema', 'erro', 'não funciona', 'ajuda']
    },
    general: {
      id: 'general',
      name: 'Geral',
      role: 'Atendimento geral',
      systemPrompt: 'Você é um assistente virtual amigável e prestativo.',
      triggers: []
    }
  };

  class MultiAgentSystem {
    constructor() {
      this.agents = new Map();
      this.activeAgent = 'general';
      this.conversationContext = [];
      this.stats = { routings: {}, totalQueries: 0 };
      this.initialized = false;
    }

    async init() {
      await this._loadData();
      this.initialized = true;
      console.log('[MultiAgent] Initialized with', this.agents.size, 'agents');
    }

    async _loadData() {
      try {
        const data = await this._getStorage(CONFIG.STORAGE_KEY);
        if (data?.agents) {
          for (const [id, agent] of Object.entries(data.agents)) {
            this.agents.set(id, agent);
          }
          this.stats = data.stats || this.stats;
        } else {
          for (const [id, agent] of Object.entries(DEFAULT_AGENTS)) {
            this.agents.set(id, agent);
          }
        }
      } catch (e) {
        for (const [id, agent] of Object.entries(DEFAULT_AGENTS)) {
          this.agents.set(id, agent);
        }
      }
    }

    async _saveData() {
      await this._setStorage(CONFIG.STORAGE_KEY, {
        agents: Object.fromEntries(this.agents),
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
     * Roteia para o agente apropriado
     */
    async route(message) {
      this.stats.totalQueries++;
      const messageLower = message.toLowerCase();

      // Verificar triggers
      for (const [id, agent] of this.agents) {
        if (id === 'router') continue;
        if (agent.triggers?.some(t => messageLower.includes(t.toLowerCase()))) {
          this.activeAgent = id;
          this.stats.routings[id] = (this.stats.routings[id] || 0) + 1;
          this._saveData();
          return this.agents.get(id);
        }
      }

      // Fallback para geral
      this.activeAgent = 'general';
      this.stats.routings['general'] = (this.stats.routings['general'] || 0) + 1;
      this._saveData();
      return this.agents.get('general');
    }

    /**
     * Obtém system prompt do agente ativo
     */
    getActiveSystemPrompt() {
      const agent = this.agents.get(this.activeAgent);
      return agent?.systemPrompt || DEFAULT_AGENTS.general.systemPrompt;
    }

    /**
     * Cria novo agente
     */
    async createAgent(config) {
      if (this.agents.size >= CONFIG.MAX_AGENTS) {
        throw new Error('Maximum agents reached');
      }

      const id = `agent_${Date.now()}`;
      const agent = {
        id,
        name: config.name || 'Novo Agente',
        role: config.role || '',
        systemPrompt: config.systemPrompt || '',
        triggers: config.triggers || [],
        createdAt: Date.now()
      };

      this.agents.set(id, agent);
      await this._saveData();
      return agent;
    }

    /**
     * Lista agentes
     */
    listAgents() {
      return Array.from(this.agents.values())
        .filter(a => !a.isSystem)
        .map(a => ({
          id: a.id,
          name: a.name,
          role: a.role,
          triggers: a.triggers,
          isActive: a.id === this.activeAgent,
          usageCount: this.stats.routings[a.id] || 0
        }));
    }

    /**
     * Remove agente
     */
    async deleteAgent(agentId) {
      if (['router', 'general'].includes(agentId)) return false;
      this.agents.delete(agentId);
      await this._saveData();
      return true;
    }

    getStats() {
      return {
        totalAgents: this.agents.size - 1, // Excluir router
        activeAgent: this.activeAgent,
        totalQueries: this.stats.totalQueries,
        routings: this.stats.routings
      };
    }
  }

  const multiAgent = new MultiAgentSystem();
  multiAgent.init();

  window.WHLMultiAgent = multiAgent;
  console.log('[ADV-001] Multi-Agent System initialized');

})();
