/**
 * ADV-006: Contextual Memory Network - Rede de memória contextual avançada
 * 
 * @version 1.0.0
 * @since 7.9.14
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'whl_contextual_memory',
    MAX_MEMORIES_PER_CONTACT: 100,
    MEMORY_DECAY_DAYS: 90,
    RELEVANCE_THRESHOLD: 0.3
  };

  const MEMORY_TYPES = {
    FACT: 'fact',
    PREFERENCE: 'preference',
    INTERACTION: 'interaction',
    SENTIMENT: 'sentiment',
    CONTEXT: 'context'
  };

  class ContextualMemoryNetwork {
    constructor() {
      this.memories = new Map(); // contactId -> memories[]
      this.globalMemories = []; // Memórias compartilhadas
      this.associations = new Map(); // memory_id -> related_memory_ids
      this.initialized = false;
    }

    async init() {
      await this._loadData();
      this.initialized = true;
      console.log('[ContextualMemory] Initialized');
    }

    async _loadData() {
      try {
        const data = await this._getStorage(CONFIG.STORAGE_KEY);
        if (data) {
          this.memories = new Map(Object.entries(data.memories || {}));
          this.globalMemories = data.globalMemories || [];
          this.associations = new Map(Object.entries(data.associations || {}));
        }
      } catch (e) {
        console.warn('[ContextualMemory] Load failed:', e);
      }
    }

    async _saveData() {
      await this._setStorage(CONFIG.STORAGE_KEY, {
        memories: Object.fromEntries(this.memories),
        globalMemories: this.globalMemories,
        associations: Object.fromEntries(this.associations)
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
     * Armazena uma memória
     */
    store(contactId, content, type = MEMORY_TYPES.FACT, metadata = {}) {
      const memory = {
        id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        content,
        type,
        metadata,
        importance: metadata.importance || 0.5,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        keywords: this._extractKeywords(content)
      };

      if (contactId) {
        if (!this.memories.has(contactId)) {
          this.memories.set(contactId, []);
        }
        
        const contactMemories = this.memories.get(contactId);
        
        // Verificar duplicatas
        const isDuplicate = contactMemories.some(m => 
          this._similarity(m.content, content) > 0.9
        );
        
        if (!isDuplicate) {
          contactMemories.push(memory);
          
          // Limitar por contato
          if (contactMemories.length > CONFIG.MAX_MEMORIES_PER_CONTACT) {
            this._pruneContactMemories(contactId);
          }
        }
      } else {
        this.globalMemories.push(memory);
      }

      this._saveData();
      return memory.id;
    }

    _extractKeywords(text) {
      return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 10);
    }

    _similarity(s1, s2) {
      const words1 = new Set(s1.toLowerCase().split(/\s+/));
      const words2 = new Set(s2.toLowerCase().split(/\s+/));
      const intersection = [...words1].filter(w => words2.has(w)).length;
      return intersection / Math.max(words1.size, words2.size);
    }

    _pruneContactMemories(contactId) {
      const memories = this.memories.get(contactId);
      if (!memories) return;

      // Calcular score de retenção
      const scored = memories.map(m => ({
        memory: m,
        score: this._calculateRetentionScore(m)
      }));

      scored.sort((a, b) => b.score - a.score);
      
      this.memories.set(
        contactId, 
        scored.slice(0, CONFIG.MAX_MEMORIES_PER_CONTACT).map(s => s.memory)
      );
    }

    _calculateRetentionScore(memory) {
      const ageDays = (Date.now() - memory.createdAt) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.exp(-ageDays / CONFIG.MEMORY_DECAY_DAYS);
      
      return (
        memory.importance * 0.4 +
        decayFactor * 0.3 +
        Math.min(1, memory.accessCount / 10) * 0.3
      );
    }

    /**
     * Recupera memórias relevantes
     */
    recall(contactId, query, options = {}) {
      const { limit = 5, types = null, minRelevance = CONFIG.RELEVANCE_THRESHOLD } = options;
      
      let allMemories = [...this.globalMemories];
      
      if (contactId && this.memories.has(contactId)) {
        allMemories = [...allMemories, ...this.memories.get(contactId)];
      }

      // Filtrar por tipo
      if (types) {
        allMemories = allMemories.filter(m => types.includes(m.type));
      }

      // Calcular relevância
      const queryKeywords = this._extractKeywords(query);
      const scored = allMemories.map(m => ({
        memory: m,
        relevance: this._calculateRelevance(m, queryKeywords)
      }));

      // Filtrar e ordenar
      const relevant = scored
        .filter(s => s.relevance >= minRelevance)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

      // Atualizar acesso
      for (const { memory } of relevant) {
        memory.lastAccessed = Date.now();
        memory.accessCount++;
      }

      this._saveData();

      return relevant.map(s => ({
        ...s.memory,
        relevance: s.relevance
      }));
    }

    _calculateRelevance(memory, queryKeywords) {
      const memoryKeywords = new Set(memory.keywords);
      const overlap = queryKeywords.filter(k => memoryKeywords.has(k)).length;
      
      const keywordScore = overlap / Math.max(queryKeywords.length, 1);
      const recencyScore = Math.exp(-(Date.now() - memory.lastAccessed) / (30 * 24 * 60 * 60 * 1000));
      
      return keywordScore * 0.7 + recencyScore * 0.3;
    }

    /**
     * Cria associação entre memórias
     */
    associate(memoryId1, memoryId2, strength = 1) {
      if (!this.associations.has(memoryId1)) {
        this.associations.set(memoryId1, []);
      }
      if (!this.associations.has(memoryId2)) {
        this.associations.set(memoryId2, []);
      }

      this.associations.get(memoryId1).push({ id: memoryId2, strength });
      this.associations.get(memoryId2).push({ id: memoryId1, strength });
      
      this._saveData();
    }

    /**
     * Obtém memórias associadas
     */
    getAssociated(memoryId, depth = 1) {
      const visited = new Set([memoryId]);
      let current = [memoryId];
      const results = [];

      for (let d = 0; d < depth; d++) {
        const next = [];
        for (const id of current) {
          const assocs = this.associations.get(id) || [];
          for (const assoc of assocs) {
            if (!visited.has(assoc.id)) {
              visited.add(assoc.id);
              next.push(assoc.id);
              results.push({ id: assoc.id, distance: d + 1, strength: assoc.strength });
            }
          }
        }
        current = next;
      }

      return results;
    }

    /**
     * Gera contexto para prompt
     */
    generateContext(contactId, query, maxTokens = 500) {
      const memories = this.recall(contactId, query, { limit: 10 });
      
      if (memories.length === 0) return '';

      const parts = [];
      let tokenEstimate = 0;

      for (const memory of memories) {
        const text = `[${memory.type}] ${memory.content}`;
        const tokens = text.split(/\s+/).length;
        
        if (tokenEstimate + tokens > maxTokens) break;
        
        parts.push(text);
        tokenEstimate += tokens;
      }

      return `MEMÓRIAS RELEVANTES:\n${parts.join('\n')}`;
    }

    getStats(contactId = null) {
      if (contactId) {
        const memories = this.memories.get(contactId) || [];
        return {
          totalMemories: memories.length,
          byType: this._countByType(memories),
          oldestMemory: memories.length > 0 
            ? new Date(Math.min(...memories.map(m => m.createdAt))).toLocaleDateString()
            : 'N/A'
        };
      }

      const allContactMemories = Array.from(this.memories.values()).flat();
      return {
        contacts: this.memories.size,
        totalContactMemories: allContactMemories.length,
        globalMemories: this.globalMemories.length,
        associations: this.associations.size
      };
    }

    _countByType(memories) {
      const counts = {};
      for (const m of memories) {
        counts[m.type] = (counts[m.type] || 0) + 1;
      }
      return counts;
    }
  }

  const contextualMemory = new ContextualMemoryNetwork();
  contextualMemory.init();

  window.WHLContextualMemory = contextualMemory;
  window.WHLMemoryTypes = MEMORY_TYPES;
  console.log('[ADV-006] Contextual Memory Network initialized');

})();
