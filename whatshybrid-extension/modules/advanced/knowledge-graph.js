/**
 * ADV-003: Knowledge Graph - Grafo de conhecimento para relações semânticas
 * 
 * @version 1.0.0
 * @since 7.9.14
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'whl_knowledge_graph',
    MAX_NODES: 5000,
    MAX_EDGES: 10000
  };

  class KnowledgeGraph {
    constructor() {
      this.nodes = new Map(); // id -> { id, label, type, properties }
      this.edges = new Map(); // id -> { from, to, type, weight }
      this.nodeIndex = new Map(); // label -> id (for fast lookup)
      this.initialized = false;
    }

    async init() {
      await this._loadData();
      this.initialized = true;
      console.log('[KnowledgeGraph] Initialized:', this.nodes.size, 'nodes,', this.edges.size, 'edges');
    }

    async _loadData() {
      try {
        const data = await this._getStorage(CONFIG.STORAGE_KEY);
        if (data) {
          if (data.nodes) {
            for (const node of data.nodes) {
              this.nodes.set(node.id, node);
              this.nodeIndex.set(node.label.toLowerCase(), node.id);
            }
          }
          if (data.edges) {
            for (const edge of data.edges) {
              this.edges.set(edge.id, edge);
            }
          }
        }
      } catch (e) {
        console.warn('[KnowledgeGraph] Load failed:', e);
      }
    }

    async _saveData() {
      await this._setStorage(CONFIG.STORAGE_KEY, {
        nodes: Array.from(this.nodes.values()),
        edges: Array.from(this.edges.values())
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
     * Adiciona nó ao grafo
     */
    addNode(label, type = 'entity', properties = {}) {
      const existingId = this.nodeIndex.get(label.toLowerCase());
      if (existingId) {
        const existing = this.nodes.get(existingId);
        existing.properties = { ...existing.properties, ...properties };
        return existingId;
      }

      if (this.nodes.size >= CONFIG.MAX_NODES) {
        this._pruneOldNodes();
      }

      const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const node = {
        id,
        label,
        type,
        properties,
        createdAt: Date.now(),
        accessCount: 0
      };

      this.nodes.set(id, node);
      this.nodeIndex.set(label.toLowerCase(), id);
      this._scheduleSave();
      return id;
    }

    /**
     * Adiciona aresta entre nós
     */
    addEdge(fromLabel, toLabel, relationType = 'related', weight = 1) {
      const fromId = this.nodeIndex.get(fromLabel.toLowerCase()) || this.addNode(fromLabel);
      const toId = this.nodeIndex.get(toLabel.toLowerCase()) || this.addNode(toLabel);

      // Verificar se aresta já existe
      const existingEdge = Array.from(this.edges.values()).find(
        e => e.from === fromId && e.to === toId && e.type === relationType
      );

      if (existingEdge) {
        existingEdge.weight = Math.min(10, existingEdge.weight + 0.1);
        existingEdge.lastUsed = Date.now();
        return existingEdge.id;
      }

      if (this.edges.size >= CONFIG.MAX_EDGES) {
        this._pruneOldEdges();
      }

      const id = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const edge = {
        id,
        from: fromId,
        to: toId,
        type: relationType,
        weight,
        createdAt: Date.now(),
        lastUsed: Date.now()
      };

      this.edges.set(id, edge);
      this._scheduleSave();
      return id;
    }

    /**
     * Busca nós relacionados
     */
    getRelated(label, depth = 1, types = null) {
      const nodeId = this.nodeIndex.get(label.toLowerCase());
      if (!nodeId) return [];

      const visited = new Set([nodeId]);
      const results = [];
      let currentLevel = [nodeId];

      for (let d = 0; d < depth; d++) {
        const nextLevel = [];

        for (const id of currentLevel) {
          for (const edge of this.edges.values()) {
            if (types && !types.includes(edge.type)) continue;

            let targetId = null;
            if (edge.from === id && !visited.has(edge.to)) {
              targetId = edge.to;
            } else if (edge.to === id && !visited.has(edge.from)) {
              targetId = edge.from;
            }

            if (targetId) {
              visited.add(targetId);
              nextLevel.push(targetId);
              const node = this.nodes.get(targetId);
              if (node) {
                results.push({
                  ...node,
                  distance: d + 1,
                  relationWeight: edge.weight,
                  relationType: edge.type
                });
              }
            }
          }
        }

        currentLevel = nextLevel;
      }

      return results.sort((a, b) => a.distance - b.distance || b.relationWeight - a.relationWeight);
    }

    /**
     * Encontra caminho entre dois nós
     */
    findPath(fromLabel, toLabel, maxDepth = 5) {
      const fromId = this.nodeIndex.get(fromLabel.toLowerCase());
      const toId = this.nodeIndex.get(toLabel.toLowerCase());
      if (!fromId || !toId) return null;

      const visited = new Set();
      const queue = [[fromId]];

      while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];

        if (path.length > maxDepth) continue;
        if (current === toId) {
          return path.map(id => this.nodes.get(id)?.label).filter(Boolean);
        }

        if (visited.has(current)) continue;
        visited.add(current);

        for (const edge of this.edges.values()) {
          let next = null;
          if (edge.from === current) next = edge.to;
          else if (edge.to === current) next = edge.from;

          if (next && !visited.has(next)) {
            queue.push([...path, next]);
          }
        }
      }

      return null;
    }

    /**
     * Extrai entidades de texto e adiciona ao grafo
     */
    extractAndAdd(text, context = {}) {
      const entities = this._extractEntities(text);
      const addedNodes = [];

      for (const entity of entities) {
        const id = this.addNode(entity.text, entity.type, context);
        addedNodes.push(id);
      }

      // Criar relações entre entidades no mesmo texto
      for (let i = 0; i < addedNodes.length; i++) {
        for (let j = i + 1; j < addedNodes.length; j++) {
          const node1 = this.nodes.get(addedNodes[i]);
          const node2 = this.nodes.get(addedNodes[j]);
          if (node1 && node2) {
            this.addEdge(node1.label, node2.label, 'co_occurrence');
          }
        }
      }

      return addedNodes;
    }

    _extractEntities(text) {
      const entities = [];
      
      // Padrões simples para extração
      const patterns = [
        { type: 'product', pattern: /\b[A-Z][a-zA-Z0-9]+ (?:Pro|Plus|Max|Mini|XL|SE)\b/g },
        { type: 'price', pattern: /R\$\s*[\d.,]+/g },
        { type: 'date', pattern: /\d{1,2}\/\d{1,2}\/\d{2,4}/g },
        { type: 'email', pattern: /[\w.-]+@[\w.-]+\.\w+/g },
        { type: 'phone', pattern: /\(\d{2}\)\s*\d{4,5}-?\d{4}/g }
      ];

      for (const { type, pattern } of patterns) {
        const matches = text.match(pattern) || [];
        for (const match of matches) {
          entities.push({ text: match, type });
        }
      }

      return entities;
    }

    _pruneOldNodes() {
      const sorted = Array.from(this.nodes.values())
        .sort((a, b) => a.accessCount - b.accessCount);
      
      const toRemove = sorted.slice(0, Math.floor(this.nodes.size * 0.2));
      for (const node of toRemove) {
        this.nodes.delete(node.id);
        this.nodeIndex.delete(node.label.toLowerCase());
        // Remover arestas associadas
        for (const [edgeId, edge] of this.edges) {
          if (edge.from === node.id || edge.to === node.id) {
            this.edges.delete(edgeId);
          }
        }
      }
    }

    _pruneOldEdges() {
      const sorted = Array.from(this.edges.values())
        .sort((a, b) => a.weight - b.weight);
      
      const toRemove = sorted.slice(0, Math.floor(this.edges.size * 0.2));
      for (const edge of toRemove) {
        this.edges.delete(edge.id);
      }
    }

    _scheduleSave = (() => {
      let timeout = null;
      return () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          this._saveData();
          timeout = null;
        }, 5000);
      };
    })();

    getStats() {
      return {
        nodes: this.nodes.size,
        edges: this.edges.size,
        nodeTypes: this._countByProperty(this.nodes, 'type'),
        edgeTypes: this._countByProperty(this.edges, 'type')
      };
    }

    _countByProperty(map, prop) {
      const counts = {};
      for (const item of map.values()) {
        counts[item[prop]] = (counts[item[prop]] || 0) + 1;
      }
      return counts;
    }

    exportData() {
      return {
        nodes: Array.from(this.nodes.values()),
        edges: Array.from(this.edges.values()),
        stats: this.getStats(),
        exportedAt: new Date().toISOString()
      };
    }
  }

  const kg = new KnowledgeGraph();
  kg.init();

  window.WHLKnowledgeGraph = kg;
  console.log('[ADV-003] Knowledge Graph initialized');

})();
