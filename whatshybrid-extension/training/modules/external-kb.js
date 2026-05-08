/**
 * 🔗 External Knowledge Base - Integração com Bases Externas
 * Conecta com Google Sheets, Notion, APIs customizadas
 * 
 * @version 1.0.0
 */

class ExternalKnowledgeBase {
  constructor() {
    this.connectors = new Map();
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
    this.syncStatus = {};
  }

  // ============================================
  // GOOGLE SHEETS
  // ============================================

  /**
   * Configura conector do Google Sheets
   */
  configureGoogleSheets(config) {
    const {
      spreadsheetId,
      apiKey,
      sheets = []
    } = config;

    if (!spreadsheetId) {
      throw new Error('spreadsheetId é obrigatório');
    }

    this.connectors.set('google_sheets', {
      type: 'google_sheets',
      spreadsheetId,
      apiKey,
      sheets,
      configuredAt: Date.now()
    });

    console.log('[ExternalKB] Google Sheets configurado');
    return true;
  }

  /**
   * Busca dados do Google Sheets
   */
  async fetchGoogleSheets(sheetName, range = 'A:Z') {
    const connector = this.connectors.get('google_sheets');
    if (!connector) {
      throw new Error('Google Sheets não configurado');
    }

    const cacheKey = `gsheets_${sheetName}_${range}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${connector.spreadsheetId}/values/${sheetName}!${range}?key=${connector.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google Sheets API error: ${response.status}`);
      }

      const data = await response.json();
      const rows = data.values || [];

      // Converter para objetos
      if (rows.length > 1) {
        const headers = rows[0].map(h => h.toLowerCase().trim());
        const items = rows.slice(1).map(row => {
          const obj = {};
          headers.forEach((h, i) => {
            obj[h] = row[i] || '';
          });
          return obj;
        });

        this.setCache(cacheKey, items);
        return items;
      }

      return [];
    } catch (error) {
      console.error('[ExternalKB] Erro ao buscar Google Sheets:', error);
      throw error;
    }
  }

  // ============================================
  // AIRTABLE
  // ============================================

  /**
   * Configura conector do Airtable
   */
  configureAirtable(config) {
    const { baseId, apiKey, tables = [] } = config;

    if (!baseId || !apiKey) {
      throw new Error('baseId e apiKey são obrigatórios');
    }

    this.connectors.set('airtable', {
      type: 'airtable',
      baseId,
      apiKey,
      tables,
      configuredAt: Date.now()
    });

    console.log('[ExternalKB] Airtable configurado');
    return true;
  }

  /**
   * Busca dados do Airtable
   */
  async fetchAirtable(tableName, options = {}) {
    const connector = this.connectors.get('airtable');
    if (!connector) {
      throw new Error('Airtable não configurado');
    }

    const cacheKey = `airtable_${tableName}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      let url = `https://api.airtable.com/v0/${connector.baseId}/${encodeURIComponent(tableName)}`;
      
      if (options.view) {
        url += `?view=${encodeURIComponent(options.view)}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${connector.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status}`);
      }

      const data = await response.json();
      const items = data.records.map(r => ({
        id: r.id,
        ...r.fields
      }));

      this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      console.error('[ExternalKB] Erro ao buscar Airtable:', error);
      throw error;
    }
  }

  // ============================================
  // NOTION
  // ============================================

  /**
   * Configura conector do Notion
   */
  configureNotion(config) {
    const { apiKey, databases = [] } = config;

    if (!apiKey) {
      throw new Error('apiKey é obrigatório');
    }

    this.connectors.set('notion', {
      type: 'notion',
      apiKey,
      databases,
      configuredAt: Date.now()
    });

    console.log('[ExternalKB] Notion configurado');
    return true;
  }

  /**
   * Busca dados do Notion
   */
  async fetchNotion(databaseId) {
    const connector = this.connectors.get('notion');
    if (!connector) {
      throw new Error('Notion não configurado');
    }

    const cacheKey = `notion_${databaseId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connector.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`Notion API error: ${response.status}`);
      }

      const data = await response.json();
      const items = data.results.map(page => this.parseNotionPage(page));

      this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      console.error('[ExternalKB] Erro ao buscar Notion:', error);
      throw error;
    }
  }

  /**
   * Parser de página do Notion
   */
  parseNotionPage(page) {
    const result = { id: page.id };

    Object.entries(page.properties || {}).forEach(([key, prop]) => {
      const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
      
      switch (prop.type) {
        case 'title':
          result[normalizedKey] = prop.title?.[0]?.plain_text || '';
          break;
        case 'rich_text':
          result[normalizedKey] = prop.rich_text?.[0]?.plain_text || '';
          break;
        case 'number':
          result[normalizedKey] = prop.number;
          break;
        case 'select':
          result[normalizedKey] = prop.select?.name || '';
          break;
        case 'multi_select':
          result[normalizedKey] = prop.multi_select?.map(s => s.name) || [];
          break;
        case 'checkbox':
          result[normalizedKey] = prop.checkbox;
          break;
        case 'url':
          result[normalizedKey] = prop.url;
          break;
        case 'email':
          result[normalizedKey] = prop.email;
          break;
        default:
          result[normalizedKey] = prop[prop.type];
      }
    });

    return result;
  }

  // ============================================
  // API CUSTOMIZADA
  // ============================================

  /**
   * Configura API customizada
   */
  configureCustomAPI(name, config) {
    const { baseUrl, headers = {}, authType = 'none', authConfig = {} } = config;

    if (!baseUrl) {
      throw new Error('baseUrl é obrigatório');
    }

    this.connectors.set(`custom_${name}`, {
      type: 'custom',
      name,
      baseUrl,
      headers,
      authType,
      authConfig,
      configuredAt: Date.now()
    });

    console.log(`[ExternalKB] API customizada '${name}' configurada`);
    return true;
  }

  /**
   * Busca dados de API customizada
   */
  async fetchCustomAPI(name, endpoint, options = {}) {
    const connector = this.connectors.get(`custom_${name}`);
    if (!connector) {
      throw new Error(`API '${name}' não configurada`);
    }

    const cacheKey = `custom_${name}_${endpoint}`;
    const cached = this.getFromCache(cacheKey);
    if (cached && !options.skipCache) return cached;

    try {
      const url = `${connector.baseUrl}${endpoint}`;
      const headers = { ...connector.headers };

      // Adicionar autenticação
      if (connector.authType === 'bearer') {
        headers['Authorization'] = `Bearer ${connector.authConfig.token}`;
      } else if (connector.authType === 'api_key') {
        headers[connector.authConfig.headerName || 'X-API-Key'] = connector.authConfig.key;
      }

      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`[ExternalKB] Erro ao buscar API '${name}':`, error);
      throw error;
    }
  }

  // ============================================
  // SYNC E ATUALIZAÇÃO
  // ============================================

  /**
   * Sincroniza todas as fontes configuradas
   */
  async syncAll() {
    const results = {};

    for (const [key, connector] of this.connectors) {
      try {
        this.syncStatus[key] = { status: 'syncing', startedAt: Date.now() };
        
        if (connector.type === 'google_sheets') {
          for (const sheet of connector.sheets || []) {
            await this.fetchGoogleSheets(sheet);
          }
        } else if (connector.type === 'airtable') {
          for (const table of connector.tables || []) {
            await this.fetchAirtable(table);
          }
        } else if (connector.type === 'notion') {
          for (const db of connector.databases || []) {
            await this.fetchNotion(db);
          }
        }

        this.syncStatus[key] = { 
          status: 'success', 
          lastSync: Date.now() 
        };
        results[key] = { success: true };
      } catch (error) {
        this.syncStatus[key] = { 
          status: 'error', 
          error: error.message,
          lastSync: Date.now() 
        };
        results[key] = { success: false, error: error.message };
      }
    }

    return results;
  }

  /**
   * Agenda sincronização periódica
   */
  scheduleSync(intervalMinutes = 30) {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
    }

    this._syncInterval = setInterval(() => {
      this.syncAll();
    }, intervalMinutes * 60 * 1000);

    console.log(`[ExternalKB] Sync agendado a cada ${intervalMinutes} minutos`);
  }

  // ============================================
  // BUSCA UNIFICADA
  // ============================================

  /**
   * Busca em todas as fontes por termo
   */
  async search(query, options = {}) {
    const results = [];
    const queryLower = query.toLowerCase();

    // Buscar no cache
    for (const [key, value] of this.cache) {
      if (!Array.isArray(value)) continue;

      for (const item of value) {
        const matches = Object.values(item).some(v => {
          if (typeof v === 'string') {
            return v.toLowerCase().includes(queryLower);
          }
          return false;
        });

        if (matches) {
          results.push({
            source: key,
            item,
            relevance: this.calculateRelevance(item, query)
          });
        }
      }
    }

    // Ordenar por relevância
    results.sort((a, b) => b.relevance - a.relevance);

    return options.limit ? results.slice(0, options.limit) : results;
  }

  /**
   * Calcula relevância de um item
   */
  calculateRelevance(item, query) {
    const queryWords = query.toLowerCase().split(/\s+/);
    let score = 0;

    Object.entries(item).forEach(([key, value]) => {
      if (typeof value !== 'string') return;
      
      const valueLower = value.toLowerCase();
      queryWords.forEach(word => {
        if (valueLower.includes(word)) {
          score += 1;
          // Bonus se está no início
          if (valueLower.startsWith(word)) score += 0.5;
          // Bonus para campos importantes
          if (['nome', 'name', 'titulo', 'title'].includes(key)) score += 0.5;
        }
      });
    });

    return score;
  }

  // ============================================
  // CACHE
  // ============================================

  setCache(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  clearCache() {
    this.cache.clear();
  }

  // ============================================
  // GETTERS
  // ============================================

  getConnectors() {
    return Array.from(this.connectors.entries()).map(([key, config]) => ({
      id: key,
      type: config.type,
      configuredAt: config.configuredAt,
      status: this.syncStatus[key] || { status: 'not_synced' }
    }));
  }

  removeConnector(key) {
    return this.connectors.delete(key);
  }

  /**
   * Para sincronização periódica
   */
  stopSync() {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }
  }
}

// Exportar
window.ExternalKnowledgeBase = ExternalKnowledgeBase;
window.externalKB = new ExternalKnowledgeBase();

// Cleanup ao descarregar
window.addEventListener('beforeunload', () => {
  if (window.externalKB) {
    window.externalKB.stopSync();
  }
});

console.log('[ExternalKB] ✅ Módulo de KB externa carregado');
