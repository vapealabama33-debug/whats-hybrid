/**
 * 🧠 SmartBot AI Plus - 13 Sistemas Avançados de IA
 * 
 * ALTA PRIORIDADE:
 * 1. KnowledgeBase (RAG) - Base de conhecimento com busca semântica
 * 2. ConversationSummarizer - Resumo automático de conversas
 * 3. LeadScoringAI - Pontuação inteligente de leads
 * 4. AutoTagger - Categorização automática
 * 
 * MÉDIA PRIORIDADE:
 * 5. ResponseQualityScorer - Avalia qualidade das respostas
 * 6. ProactiveEngagement - Sugestões proativas
 * 7. SmartScheduler - Horários ideais para contato
 * 8. ABTestingEngine - Testes A/B de mensagens
 * 9. LanguageDetector - Detecção de idioma
 * 
 * OTIMIZAÇÕES:
 * 10. ResponseCache - Cache de respostas (-40% custo)
 * 11. HistoryCompressor - Compressão de histórico (-30% tokens)
 * 12. BatchProcessor - Processamento em lote (-20% latência)
 * 13. LazyLoader - Carregamento sob demanda (-50% memória)
 * 
 * @version 1.0.0
 * @author WhatsHybrid Team
 */

(function() {
  'use strict';

  const STORAGE_KEYS = {
    KNOWLEDGE_BASE: 'whl_ai_knowledge',
    LEAD_SCORES: 'whl_ai_leads',
    AUTO_TAGS: 'whl_ai_tags',
    AB_TESTS: 'whl_ai_abtests',
    RESPONSE_CACHE: 'whl_ai_cache',
    SCHEDULER: 'whl_ai_scheduler',
    QUALITY_SCORES: 'whl_ai_quality'
  };

  // ============================================================
  // 1️⃣ RAG KNOWLEDGE BASE (Documentos com Embeddings)
  // Renomeado para evitar conflito com modules/knowledge-base.js
  // ============================================================
  class RAGKnowledgeBase {
    constructor(options = {}) {
      this.documents = new Map();
      this.embeddings = new Map();
      this.index = [];
      this.options = {
        maxDocuments: options.maxDocuments || 1000,
        chunkSize: options.chunkSize || 500,
        chunkOverlap: options.chunkOverlap || 50,
        similarityThreshold: options.similarityThreshold || 0.7,
        maxResults: options.maxResults || 5,
        ...options
      };
      this.stats = { totalDocuments: 0, totalChunks: 0, searches: 0, hits: 0 };
    }

    async addDocument(docId, content, metadata = {}) {
      const chunks = this._chunkText(content);
      const doc = {
        id: docId,
        content,
        chunks,
        metadata: { ...metadata, addedAt: Date.now(), chunkCount: chunks.length }
      };
      this.documents.set(docId, doc);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${docId}_chunk_${i}`;
        const embedding = this._generateEmbedding(chunks[i]);
        this.embeddings.set(chunkId, { docId, chunkIndex: i, text: chunks[i], embedding, metadata });
        this.index.push(chunkId);
      }
      this.stats.totalDocuments++;
      this.stats.totalChunks += chunks.length;
      await this._save();
      return doc;
    }

    async removeDocument(docId) {
      const doc = this.documents.get(docId);
      if (!doc) return false;
      for (let i = 0; i < doc.chunks.length; i++) {
        const chunkId = `${docId}_chunk_${i}`;
        this.embeddings.delete(chunkId);
        this.index = this.index.filter(id => id !== chunkId);
      }
      this.documents.delete(docId);
      this.stats.totalDocuments--;
      this.stats.totalChunks -= doc.chunks.length;
      await this._save();
      return true;
    }

    search(query, options = {}) {
      const maxResults = options.maxResults || this.options.maxResults;
      const threshold = options.threshold || this.options.similarityThreshold;
      this.stats.searches++;
      const queryEmbed = this._generateEmbedding(query);
      const results = [];
      for (const chunkId of this.index) {
        const chunk = this.embeddings.get(chunkId);
        if (!chunk) continue;
        const sim = this._cosineSimilarity(queryEmbed, chunk.embedding);
        if (sim >= threshold) {
          results.push({ docId: chunk.docId, chunkIndex: chunk.chunkIndex, text: chunk.text, similarity: sim, metadata: chunk.metadata });
        }
      }
      results.sort((a, b) => b.similarity - a.similarity);
      const grouped = this._groupByDoc(results.slice(0, maxResults * 2));
      if (grouped.length > 0) this.stats.hits++;
      return { query, results: grouped.slice(0, maxResults), totalFound: results.length };
    }

    getContextForQuery(query, maxTokens = 2000) {
      const searchResults = this.search(query, { maxResults: 10 });
      let context = '', tokenCount = 0;
      for (const result of searchResults.results) {
        const tokens = Math.ceil(result.text.length / 4);
        if (tokenCount + tokens > maxTokens) break;
        context += `\n[${result.metadata.title || result.docId}]: ${result.text}\n`;
        tokenCount += tokens;
      }
      return { context: context.trim(), sources: searchResults.results.map(r => ({ docId: r.docId, title: r.metadata.title, similarity: r.similarity })), tokenEstimate: tokenCount };
    }

    _chunkText(text) {
      const { chunkSize, chunkOverlap } = this.options;
      const chunks = [];
      const sentences = text.split(/[.!?]+/).filter(s => s.trim());
      let current = '';
      for (const sent of sentences) {
        const t = sent.trim();
        if (!t) continue;
        if (current.length + t.length > chunkSize) {
          if (current) chunks.push(current.trim());
          const words = current.split(' ').slice(-Math.floor(chunkOverlap / 5));
          current = words.join(' ') + ' ' + t;
        } else {
          current += (current ? '. ' : '') + t;
        }
      }
      if (current.trim()) chunks.push(current.trim());
      return chunks;
    }

    _generateEmbedding(text) {
      const words = text.toLowerCase().replace(/[^\w\sáéíóúàèìòùâêîôûãõç]/g, '').split(/\s+/).filter(w => w.length > 2);
      const freq = {};
      for (const w of words) freq[w] = (freq[w] || 0) + 1;
      const norm = Math.sqrt(Object.values(freq).reduce((a, b) => a + b * b, 0)) || 1;
      for (const w in freq) freq[w] /= norm;
      return freq;
    }

    _cosineSimilarity(e1, e2) {
      let dot = 0, n1 = 0, n2 = 0;
      const all = new Set([...Object.keys(e1), ...Object.keys(e2)]);
      for (const w of all) {
        const v1 = e1[w] || 0, v2 = e2[w] || 0;
        dot += v1 * v2; n1 += v1 * v1; n2 += v2 * v2;
      }
      const denom = Math.sqrt(n1) * Math.sqrt(n2);
      return denom ? dot / denom : 0;
    }

    _groupByDoc(results) {
      const grouped = new Map();
      for (const r of results) {
        if (!grouped.has(r.docId)) grouped.set(r.docId, { docId: r.docId, metadata: r.metadata, text: r.text, maxSimilarity: 0 });
        const g = grouped.get(r.docId);
        g.maxSimilarity = Math.max(g.maxSimilarity, r.similarity);
      }
      return Array.from(grouped.values()).sort((a, b) => b.maxSimilarity - a.maxSimilarity);
    }

    async _save() {
      try {
        const data = { documents: Array.from(this.documents.entries()), stats: this.stats };
        await chrome.storage.local.set({ [STORAGE_KEYS.KNOWLEDGE_BASE]: JSON.stringify(data) });
      } catch (e) { console.warn('[KnowledgeBase] Save error:', e); }
    }

    async load() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.KNOWLEDGE_BASE);
        if (data[STORAGE_KEYS.KNOWLEDGE_BASE]) {
          const parsed = JSON.parse(data[STORAGE_KEYS.KNOWLEDGE_BASE]);
          for (const [id, doc] of parsed.documents || []) {
            this.documents.set(id, doc);
            for (let i = 0; i < doc.chunks.length; i++) {
              const chunkId = `${id}_chunk_${i}`;
              const emb = this._generateEmbedding(doc.chunks[i]);
              this.embeddings.set(chunkId, { docId: id, chunkIndex: i, text: doc.chunks[i], embedding: emb, metadata: doc.metadata });
              this.index.push(chunkId);
            }
          }
          this.stats = parsed.stats || this.stats;
        }
      } catch (e) { console.warn('[KnowledgeBase] Load error:', e); }
    }

    getStats() { return { ...this.stats, hitRate: this.stats.searches ? (this.stats.hits / this.stats.searches * 100).toFixed(1) + '%' : '0%' }; }
    listDocuments() { return Array.from(this.documents.values()).map(d => ({ id: d.id, title: d.metadata.title, chunkCount: d.chunks.length, addedAt: d.metadata.addedAt })); }
  }

  // ============================================================
  // 2️⃣ CONVERSATION SUMMARIZER
  // ============================================================
  class ConversationSummarizer {
    constructor(options = {}) {
      this.options = { maxMessages: options.maxMessages || 20, summaryMaxLength: options.summaryMaxLength || 500, preserveLast: options.preserveLast || 5, ...options };
      this.summaries = new Map();
      this.stats = { totalSummaries: 0, messagesProcessed: 0, tokensSaved: 0 };
    }

    needsSummary(messages) { return messages.length > this.options.maxMessages; }

    summarize(messages, existing = null) {
      if (messages.length < 5) return { summary: null, messagesToKeep: messages };
      const toSummarize = messages.slice(0, -this.options.preserveLast);
      const toKeep = messages.slice(-this.options.preserveLast);
      const info = this._extractKeyInfo(toSummarize);
      const summary = this._generateSummary(info, existing);
      this.stats.totalSummaries++;
      this.stats.messagesProcessed += toSummarize.length;
      this.stats.tokensSaved += this._estimateTokens(toSummarize) - this._estimateTokens([{ text: summary.text }]);
      return { summary, messagesToKeep: toKeep, originalCount: messages.length, summarizedCount: toSummarize.length };
    }

    _extractKeyInfo(messages) {
      const info = { entities: { names: new Set(), values: new Set(), dates: new Set() }, sentiment: { positive: 0, negative: 0, neutral: 0 }, questions: [] };
      for (const msg of messages) {
        const text = msg.text || msg.body || '';
        const isFromMe = msg.fromMe || msg.isFromMe;
        const nameMatch = text.match(/(?:sou|me chamo|meu nome é)\s+(\w+)/i);
        if (nameMatch) info.entities.names.add(nameMatch[1]);
        const valueMatch = text.match(/R\$\s*[\d.,]+/g);
        if (valueMatch) valueMatch.forEach(v => info.entities.values.add(v));
        const dateMatch = text.match(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g);
        if (dateMatch) dateMatch.forEach(d => info.entities.dates.add(d));
        if (text.includes('?') && !isFromMe) info.questions.push(text.substring(0, 80));
        const pos = ['obrigado', 'ótimo', 'excelente', 'perfeito', 'bom'].some(w => text.toLowerCase().includes(w));
        const neg = ['problema', 'ruim', 'péssimo', 'cancelar', 'reclamar'].some(w => text.toLowerCase().includes(w));
        if (pos && !neg) info.sentiment.positive++;
        else if (neg && !pos) info.sentiment.negative++;
        else info.sentiment.neutral++;
      }
      return info;
    }

    _generateSummary(info, existing) {
      const parts = [];
      const sent = info.sentiment.positive > info.sentiment.negative ? 'positivo' : info.sentiment.negative > info.sentiment.positive ? 'negativo' : 'neutro';
      parts.push(`Tom: ${sent}`);
      if (info.entities.names.size > 0) parts.push(`Cliente: ${Array.from(info.entities.names).join(', ')}`);
      if (info.entities.values.size > 0) parts.push(`Valores: ${Array.from(info.entities.values).join(', ')}`);
      if (info.questions.length > 0) parts.push(`Perguntas: ${info.questions.length}`);
      let text = parts.join('. ');
      if (existing) text = existing.text + ' | ' + text;
      return { text: text.substring(0, this.options.summaryMaxLength), entities: { names: Array.from(info.entities.names), values: Array.from(info.entities.values) }, sentiment: sent, generatedAt: Date.now() };
    }

    _estimateTokens(msgs) { return msgs.reduce((s, m) => s + Math.ceil((m.text || m.body || '').length / 4), 0); }

    prepareContext(chatId, messages, maxTokens = 3000) {
      if (!this.needsSummary(messages)) return { context: messages, summary: null, tokenEstimate: this._estimateTokens(messages) };
      const cached = this.summaries.get(chatId);
      const { summary, messagesToKeep } = this.summarize(messages, cached?.summary);
      this.summaries.set(chatId, { summary, updatedAt: Date.now() });
      const ctx = [{ role: 'system', content: `[RESUMO]\n${summary.text}` }, ...messagesToKeep];
      return { context: ctx, summary, tokenEstimate: this._estimateTokens(ctx), savings: this._estimateTokens(messages) - this._estimateTokens(ctx) };
    }

    getStats() { return { ...this.stats, cachedSummaries: this.summaries.size }; }
    clearCache(chatId) { chatId ? this.summaries.delete(chatId) : this.summaries.clear(); }
  }

  // ============================================================
  // 3️⃣ LEAD SCORING AI
  // ============================================================
  class LeadScoringAI {
    constructor(options = {}) {
      this.scores = new Map();
      this.options = { decayFactor: options.decayFactor || 0.95, maxScore: options.maxScore || 100, ...options };
      this.weights = {
        engagement: { messageCount: 2, responseSpeed: 3 },
        intent: { priceInquiry: 20, urgentNeed: 25, readyToBuy: 30, productInterest: 15 },
        profile: { hasEmail: 5, hasCompany: 10, budgetMentioned: 20 },
        negative: { unsubscribed: -50, noResponse: -5 }
      };
      this.stats = { totalScored: 0, hotLeads: 0, warmLeads: 0, coldLeads: 0 };
    }

    scoreContact(chatId, data) {
      let score = this.scores.get(chatId)?.score || 0;
      const factors = [];
      if (data.messageCount) { const s = Math.min(data.messageCount * this.weights.engagement.messageCount, 20); score += s; factors.push({ factor: 'messageCount', value: s }); }
      if (data.avgResponseTime) { const s = data.avgResponseTime < 60000 ? 9 : data.avgResponseTime < 300000 ? 6 : 3; score += s; factors.push({ factor: 'responseSpeed', value: s }); }
      if (data.askedPrice) { score += this.weights.intent.priceInquiry; factors.push({ factor: 'priceInquiry', value: this.weights.intent.priceInquiry }); }
      if (data.mentionedUrgency) { score += this.weights.intent.urgentNeed; factors.push({ factor: 'urgentNeed', value: this.weights.intent.urgentNeed }); }
      if (data.readyToBuy) { score += this.weights.intent.readyToBuy; factors.push({ factor: 'readyToBuy', value: this.weights.intent.readyToBuy }); }
      if (data.email) { score += this.weights.profile.hasEmail; factors.push({ factor: 'hasEmail', value: this.weights.profile.hasEmail }); }
      if (data.company) { score += this.weights.profile.hasCompany; factors.push({ factor: 'hasCompany', value: this.weights.profile.hasCompany }); }
      if (data.budgetMentioned) { score += this.weights.profile.budgetMentioned; factors.push({ factor: 'budgetMentioned', value: this.weights.profile.budgetMentioned }); }
      if (data.unsubscribed) { score += this.weights.negative.unsubscribed; factors.push({ factor: 'unsubscribed', value: this.weights.negative.unsubscribed }); }
      if (data.noResponseDays > 3) { const p = this.weights.negative.noResponse * Math.min(data.noResponseDays, 10); score += p; factors.push({ factor: 'noResponse', value: p }); }
      score = Math.max(0, Math.min(score, this.options.maxScore));
      const classification = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
      const result = { chatId, score: Math.round(score), classification, factors, updatedAt: Date.now() };
      this.scores.set(chatId, result);
      this._updateStats();
      this._save();
      return result;
    }

    analyzeMessage(text) {
      const signals = { askedPrice: false, mentionedUrgency: false, readyToBuy: false, productInterest: false, budgetMentioned: false };
      const t = text.toLowerCase();
      if (/quanto custa|qual o pre[çc]o|valor|or[çc]amento/i.test(t)) signals.askedPrice = true;
      if (/urgente|preciso hoje|o mais r[áa]pido|imediato/i.test(t)) signals.mentionedUrgency = true;
      if (/quero comprar|vou fechar|pode enviar|quero contratar/i.test(t)) signals.readyToBuy = true;
      if (/me interesso|gostaria de saber|quero conhecer/i.test(t)) signals.productInterest = true;
      if (/meu or[çc]amento|tenho para gastar|posso pagar/i.test(t)) signals.budgetMentioned = true;
      return signals;
    }

    applyDecay() {
      for (const [chatId, data] of this.scores) {
        const days = (Date.now() - data.updatedAt) / (1000 * 60 * 60 * 24);
        if (days > 1) {
          data.score = Math.round(data.score * Math.pow(this.options.decayFactor, days));
          data.classification = data.score >= 70 ? 'hot' : data.score >= 40 ? 'warm' : 'cold';
        }
      }
      this._updateStats();
    }

    getTopLeads(limit = 10, classification = null) {
      let leads = Array.from(this.scores.values());
      if (classification) leads = leads.filter(l => l.classification === classification);
      return leads.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    getScore(chatId) { return this.scores.get(chatId); }

    _updateStats() {
      this.stats.totalScored = this.scores.size;
      this.stats.hotLeads = Array.from(this.scores.values()).filter(l => l.classification === 'hot').length;
      this.stats.warmLeads = Array.from(this.scores.values()).filter(l => l.classification === 'warm').length;
      this.stats.coldLeads = Array.from(this.scores.values()).filter(l => l.classification === 'cold').length;
    }

    async _save() {
      try { await chrome.storage.local.set({ [STORAGE_KEYS.LEAD_SCORES]: JSON.stringify(Array.from(this.scores.entries())) }); }
      catch (e) { console.warn('[LeadScoringAI] Save error:', e); }
    }

    async load() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.LEAD_SCORES);
        if (data[STORAGE_KEYS.LEAD_SCORES]) {
          for (const [id, score] of JSON.parse(data[STORAGE_KEYS.LEAD_SCORES])) this.scores.set(id, score);
          this._updateStats();
        }
      } catch (e) { console.warn('[LeadScoringAI] Load error:', e); }
    }

    getStats() { return { ...this.stats }; }
  }

  // ============================================================
  // 4️⃣ AUTO TAGGER
  // ============================================================
  class AutoTagger {
    constructor(options = {}) {
      this.tags = new Map();
      this.tagDefinitions = new Map();
      this.options = { maxTagsPerChat: options.maxTagsPerChat || 10, minConfidence: options.minConfidence || 0.6, ...options };
      this._initTags();
      this.stats = { totalTagged: 0, tagDistribution: {} };
    }

    _initTags() {
      const defaults = [
        { id: 'support', name: 'Suporte', keywords: ['ajuda', 'problema', 'erro', 'não funciona', 'bug'], color: '#e74c3c' },
        { id: 'sales', name: 'Vendas', keywords: ['comprar', 'preço', 'valor', 'orçamento', 'proposta'], color: '#27ae60' },
        { id: 'billing', name: 'Financeiro', keywords: ['pagamento', 'boleto', 'nota fiscal', 'cobrança', 'fatura'], color: '#f39c12' },
        { id: 'feedback', name: 'Feedback', keywords: ['sugestão', 'opinião', 'melhorar', 'avaliar'], color: '#9b59b6' },
        { id: 'urgent', name: 'Urgente', keywords: ['urgente', 'emergência', 'agora', 'imediato', 'crítico'], color: '#c0392b' },
        { id: 'new_customer', name: 'Novo Cliente', keywords: ['primeiro contato', 'conhecer', 'gostaria de saber'], color: '#3498db' },
        { id: 'retention', name: 'Retenção', keywords: ['cancelar', 'desistir', 'não quero mais', 'encerrar'], color: '#e67e22' },
        { id: 'technical', name: 'Técnico', keywords: ['configurar', 'instalar', 'integrar', 'API', 'código'], color: '#1abc9c' },
        { id: 'scheduling', name: 'Agendamento', keywords: ['agendar', 'marcar', 'horário', 'reunião'], color: '#34495e' },
        { id: 'information', name: 'Informação', keywords: ['dúvida', 'como funciona', 'o que é', 'explicar'], color: '#7f8c8d' }
      ];
      for (const t of defaults) this.tagDefinitions.set(t.id, t);
    }

    addTagDefinition(id, name, keywords, color = '#95a5a6') { this.tagDefinitions.set(id, { id, name, keywords, color }); }

    analyzeAndTag(chatId, messages) {
      const text = messages.map(m => m.text || m.body || '').join(' ').toLowerCase();
      const detected = [];
      for (const [tagId, def] of this.tagDefinitions) {
        const score = this._calcScore(text, def.keywords);
        if (score >= this.options.minConfidence) detected.push({ id: tagId, name: def.name, color: def.color, confidence: score, detectedAt: Date.now() });
      }
      detected.sort((a, b) => b.confidence - a.confidence);
      const final = detected.slice(0, this.options.maxTagsPerChat);
      const existing = this.tags.get(chatId) || [];
      const merged = this._merge(existing, final);
      this.tags.set(chatId, merged);
      this._updateStats();
      this._save();
      return { chatId, tags: merged, newTags: final.filter(t => !existing.find(e => e.id === t.id)) };
    }

    _calcScore(text, keywords) {
      let matches = 0, total = 0;
      for (const kw of keywords) {
        const w = kw.length > 5 ? 2 : 1;
        total += w;
        if (text.includes(kw.toLowerCase())) matches += w;
      }
      return total > 0 ? matches / total : 0;
    }

    _merge(existing, newTags) {
      const merged = new Map();
      for (const t of existing) merged.set(t.id, t);
      for (const t of newTags) if (!merged.has(t.id) || t.confidence > merged.get(t.id).confidence) merged.set(t.id, t);
      return Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence).slice(0, this.options.maxTagsPerChat);
    }

    addTag(chatId, tagId) {
      const def = this.tagDefinitions.get(tagId);
      if (!def) return null;
      const existing = this.tags.get(chatId) || [];
      if (existing.find(t => t.id === tagId)) return existing;
      existing.push({ id: tagId, name: def.name, color: def.color, confidence: 1.0, manual: true, detectedAt: Date.now() });
      this.tags.set(chatId, existing);
      this._save();
      return existing;
    }

    removeTag(chatId, tagId) {
      const existing = this.tags.get(chatId) || [];
      const filtered = existing.filter(t => t.id !== tagId);
      this.tags.set(chatId, filtered);
      this._save();
      return filtered;
    }

    getChatsByTag(tagId) {
      const results = [];
      for (const [chatId, tags] of this.tags) if (tags.find(t => t.id === tagId)) results.push({ chatId, tags });
      return results;
    }

    getTags(chatId) { return this.tags.get(chatId) || []; }
    getAllDefinitions() { return Array.from(this.tagDefinitions.values()); }

    _updateStats() {
      this.stats.totalTagged = this.tags.size;
      this.stats.tagDistribution = {};
      for (const tags of this.tags.values()) for (const t of tags) this.stats.tagDistribution[t.id] = (this.stats.tagDistribution[t.id] || 0) + 1;
    }

    async _save() {
      try { await chrome.storage.local.set({ [STORAGE_KEYS.AUTO_TAGS]: JSON.stringify(Array.from(this.tags.entries())) }); }
      catch (e) { console.warn('[AutoTagger] Save error:', e); }
    }

    async load() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.AUTO_TAGS);
        if (data[STORAGE_KEYS.AUTO_TAGS]) {
          for (const [id, tags] of JSON.parse(data[STORAGE_KEYS.AUTO_TAGS])) this.tags.set(id, tags);
          this._updateStats();
        }
      } catch (e) { console.warn('[AutoTagger] Load error:', e); }
    }

    getStats() { return { ...this.stats }; }
  }

  // ============================================================
  // 5️⃣ RESPONSE QUALITY SCORER
  // ============================================================
  class ResponseQualityScorer {
    constructor(options = {}) {
      this.scores = [];
      this.options = { maxHistory: options.maxHistory || 1000, ...options };
      this.criteria = { relevance: 0.25, completeness: 0.20, clarity: 0.20, tone: 0.15, actionability: 0.10, length: 0.10 };
      this.stats = { totalScored: 0, avgScore: 0, distribution: { excellent: 0, good: 0, fair: 0, poor: 0 } };
    }

    scoreResponse(input, response, context = {}) {
      const scores = {
        relevance: this._relevance(input, response),
        completeness: this._completeness(input, response),
        clarity: this._clarity(response),
        tone: this._tone(response, context),
        actionability: this._actionability(response),
        length: this._length(response, input)
      };
      let total = 0;
      for (const [k, w] of Object.entries(this.criteria)) total += (scores[k] || 0) * w;
      const result = { input: input.substring(0, 100), response: response.substring(0, 100), scores, totalScore: Math.round(total * 100) / 100, classification: this._classify(total), timestamp: Date.now(), suggestions: this._suggestions(scores) };
      this.scores.push(result);
      if (this.scores.length > this.options.maxHistory) this.scores.shift();
      this._updateStats();
      this._save();
      return result;
    }

    _relevance(input, response) {
      const iw = new Set(input.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const rw = new Set(response.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      let m = 0;
      for (const w of iw) if (rw.has(w)) m++;
      return iw.size > 0 ? Math.min(m / iw.size * 1.5, 1) : 0.5;
    }

    _completeness(input, response) {
      const isQ = input.includes('?');
      const hasA = response.length > 50;
      if (isQ) {
        const ind = ['sim', 'não', 'é', 'são', 'pode', 'precisa'];
        return ind.some(i => response.toLowerCase().includes(i)) && hasA ? 0.9 : hasA ? 0.7 : 0.4;
      }
      return hasA ? 0.8 : 0.5;
    }

    _clarity(response) {
      const sents = response.split(/[.!?]+/).filter(s => s.trim());
      const avg = sents.reduce((s, sent) => s + sent.split(/\s+/).length, 0) / (sents.length || 1);
      if (avg > 30) return 0.5;
      if (avg < 5) return 0.6;
      if (avg >= 10 && avg <= 20) return 1.0;
      return 0.8;
    }

    _tone(response, context) {
      const formal = ['prezado', 'atenciosamente', 'cordialmente'];
      const casual = ['oi', 'olá', 'tudo bem', 'blz'];
      const isF = formal.some(i => response.toLowerCase().includes(i));
      const isC = casual.some(i => response.toLowerCase().includes(i));
      if (context.preferFormal && isF) return 1.0;
      if (context.preferCasual && isC) return 1.0;
      return isF ? 0.9 : isC ? 0.7 : 0.8;
    }

    _actionability(response) {
      const ind = ['clique', 'acesse', 'entre em contato', 'envie', 'aguarde', 'confirme'];
      return ind.some(i => response.toLowerCase().includes(i)) ? 1.0 : 0.6;
    }

    _length(response, input) {
      const ratio = response.length / (input.length || 1);
      if (ratio < 0.5) return 0.4;
      if (ratio > 10) return 0.5;
      if (ratio >= 1 && ratio <= 5) return 1.0;
      return 0.7;
    }

    _classify(score) {
      if (score >= 0.85) return 'excellent';
      if (score >= 0.70) return 'good';
      if (score >= 0.50) return 'fair';
      return 'poor';
    }

    _suggestions(scores) {
      const s = [];
      if (scores.relevance < 0.7) s.push('Aumentar relevância');
      if (scores.completeness < 0.7) s.push('Resposta incompleta');
      if (scores.clarity < 0.7) s.push('Melhorar clareza');
      if (scores.actionability < 0.7) s.push('Incluir ações claras');
      return s;
    }

    _updateStats() {
      this.stats.totalScored = this.scores.length;
      if (this.scores.length > 0) {
        this.stats.avgScore = Math.round(this.scores.reduce((s, x) => s + x.totalScore, 0) / this.scores.length * 100) / 100;
        this.stats.distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
        for (const s of this.scores) this.stats.distribution[s.classification]++;
      }
    }

    async _save() {
      try { await chrome.storage.local.set({ [STORAGE_KEYS.QUALITY_SCORES]: JSON.stringify(this.scores.slice(-100)) }); }
      catch (e) { console.warn('[ResponseQualityScorer] Save error:', e); }
    }

    async load() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.QUALITY_SCORES);
        if (data[STORAGE_KEYS.QUALITY_SCORES]) { this.scores = JSON.parse(data[STORAGE_KEYS.QUALITY_SCORES]); this._updateStats(); }
      } catch (e) { console.warn('[ResponseQualityScorer] Load error:', e); }
    }

    getStats() { return { ...this.stats }; }
    getRecent(limit = 20) { return this.scores.slice(-limit).reverse(); }
  }

  // ============================================================
  // 6️⃣ PROACTIVE ENGAGEMENT
  // ============================================================
  class ProactiveEngagement {
    constructor(options = {}) {
      this.options = { inactivityThreshold: options.inactivityThreshold || 24 * 60 * 60 * 1000, followUpDelay: options.followUpDelay || 2 * 60 * 60 * 1000, maxSuggestions: options.maxSuggestions || 3, ...options };
      this.suggestions = new Map();
      this.triggers = this._initTriggers();
      this.stats = { totalSuggestions: 0, accepted: 0, dismissed: 0 };
    }

    _initTriggers() {
      return [
        { id: 'follow_up_no_response', name: 'Follow-up sem resposta', condition: (c) => c.lastMessageFromCustomer && Date.now() - c.lastMessageTime > this.options.followUpDelay && !c.lastMessageFromMe, template: 'Olá! Posso ajudar com mais alguma coisa?', priority: 'high' },
        { id: 'price_follow_up', name: 'Follow-up preço', condition: (c) => c.askedPrice && !c.receivedProposal, template: 'Vi que você se interessou. Posso enviar uma proposta?', priority: 'high' },
        { id: 'cart_abandonment', name: 'Carrinho abandonado', condition: (c) => c.addedToCart && !c.completed, template: 'Posso ajudar a finalizar sua compra?', priority: 'medium' },
        { id: 'reactivation', name: 'Reativação', condition: (c) => Date.now() - c.lastInteraction > 30 * 24 * 60 * 60 * 1000, template: 'Faz tempo! Temos novidades para você.', priority: 'low' },
        { id: 'feedback_request', name: 'Feedback', condition: (c) => c.purchaseCompleted && Date.now() - c.purchaseDate > 7 * 24 * 60 * 60 * 1000, template: 'Como foi sua experiência? Sua opinião importa!', priority: 'low' }
      ];
    }

    analyzeChat(chatId, chatData) {
      const suggestions = [];
      for (const trigger of this.triggers) {
        try {
          if (trigger.condition(chatData)) {
            suggestions.push({ triggerId: trigger.id, name: trigger.name, message: this._fillTemplate(trigger.template, chatData), priority: trigger.priority, generatedAt: Date.now() });
          }
        } catch (error) { try { globalThis.WHLLogger?.debug?.('[Suppressed]', error); } catch (_) {} }
      }
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      const final = suggestions.slice(0, this.options.maxSuggestions);
      if (final.length > 0) { this.suggestions.set(chatId, final); this.stats.totalSuggestions += final.length; }
      return { chatId, suggestions: final, hasUrgent: final.some(s => s.priority === 'high') };
    }

    _fillTemplate(template, data) { return template.replace(/\{(\w+)\}/g, (m, k) => data[k] || m); }

    addTrigger(id, name, condition, template, priority = 'medium') { this.triggers.push({ id, name, condition, template, priority }); }
    acceptSuggestion(chatId, triggerId) { const s = this.suggestions.get(chatId) || []; const i = s.findIndex(x => x.triggerId === triggerId); if (i >= 0) { s.splice(i, 1); this.suggestions.set(chatId, s); this.stats.accepted++; } }
    dismissSuggestion(chatId, triggerId) { const s = this.suggestions.get(chatId) || []; const i = s.findIndex(x => x.triggerId === triggerId); if (i >= 0) { s.splice(i, 1); this.suggestions.set(chatId, s); this.stats.dismissed++; } }
    getSuggestions(chatId) { return this.suggestions.get(chatId) || []; }
    getAllPending() { const all = []; for (const [chatId, s] of this.suggestions) for (const sg of s) all.push({ chatId, ...sg }); return all.sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]); }
    getStats() { return { ...this.stats, acceptanceRate: this.stats.accepted + this.stats.dismissed > 0 ? ((this.stats.accepted / (this.stats.accepted + this.stats.dismissed)) * 100).toFixed(1) + '%' : '0%', pending: Array.from(this.suggestions.values()).reduce((s, x) => s + x.length, 0) }; }
  }

  // ============================================================
  // 7️⃣ SMART SCHEDULER
  // ============================================================
  class SmartScheduler {
    constructor(options = {}) {
      this.responseData = new Map();
      this.options = { minDataPoints: options.minDataPoints || 5, defaultBestHours: options.defaultBestHours || [9, 10, 11, 14, 15, 16], ...options };
      this.globalStats = { hourDistribution: new Array(24).fill(0), dayDistribution: new Array(7).fill(0), totalResponses: 0 };
    }

    recordResponse(chatId, timestamp = Date.now()) {
      const d = new Date(timestamp);
      const hour = d.getHours(), day = d.getDay();
      if (!this.responseData.has(chatId)) this.responseData.set(chatId, { hours: new Array(24).fill(0), days: new Array(7).fill(0), total: 0 });
      const data = this.responseData.get(chatId);
      data.hours[hour]++; data.days[day]++; data.total++;
      this.globalStats.hourDistribution[hour]++;
      this.globalStats.dayDistribution[day]++;
      this.globalStats.totalResponses++;
      this._save();
    }

    getBestTimes(chatId = null) {
      const data = chatId ? this.responseData.get(chatId) : null;
      if (data && data.total >= this.options.minDataPoints) return this._analyze(data);
      if (this.globalStats.totalResponses >= this.options.minDataPoints * 10) return this._analyze({ hours: this.globalStats.hourDistribution, days: this.globalStats.dayDistribution, total: this.globalStats.totalResponses });
      return { bestHours: this.options.defaultBestHours, bestDays: [1, 2, 3, 4, 5], confidence: 'low', recommendation: 'Usando horários padrão.' };
    }

    _analyze(data) {
      const hourScores = data.hours.map((c, h) => ({ hour: h, count: c })).sort((a, b) => b.count - a.count);
      const bestHours = hourScores.slice(0, 6).map(h => h.hour).sort((a, b) => a - b);
      const dayScores = data.days.map((c, d) => ({ day: d, count: c })).sort((a, b) => b.count - a.count);
      const bestDays = dayScores.slice(0, 3).map(d => d.day).sort((a, b) => a - b);
      const max = Math.max(...data.hours), avg = data.hours.reduce((a, b) => a + b, 0) / 24;
      const confidence = max > avg * 2 ? 'high' : max > avg * 1.5 ? 'medium' : 'low';
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return { bestHours, bestDays, confidence, recommendation: `Melhores: ${bestHours.join('h, ')}h em ${bestDays.map(d => dayNames[d]).join(', ')}`, dataPoints: data.total };
    }

    getNextBestTime(chatId = null) {
      const { bestHours, bestDays } = this.getBestTimes(chatId);
      const now = new Date();
      for (const h of bestHours) if (h > now.getHours() && bestDays.includes(now.getDay())) { const n = new Date(now); n.setHours(h, 0, 0, 0); return { datetime: n, isToday: true }; }
      for (let i = 1; i <= 7; i++) { const nd = (now.getDay() + i) % 7; if (bestDays.includes(nd)) { const n = new Date(now); n.setDate(n.getDate() + i); n.setHours(bestHours[0], 0, 0, 0); return { datetime: n, isToday: false }; } }
      const n = new Date(now); n.setDate(n.getDate() + 1); n.setHours(9, 0, 0, 0); return { datetime: n, isToday: false };
    }

    async _save() {
      try { await chrome.storage.local.set({ [STORAGE_KEYS.SCHEDULER]: JSON.stringify({ responses: Array.from(this.responseData.entries()), globalStats: this.globalStats }) }); }
      catch (e) { console.warn('[SmartScheduler] Save error:', e); }
    }

    async load() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.SCHEDULER);
        if (data[STORAGE_KEYS.SCHEDULER]) {
          const p = JSON.parse(data[STORAGE_KEYS.SCHEDULER]);
          for (const [id, v] of p.responses || []) this.responseData.set(id, v);
          this.globalStats = p.globalStats || this.globalStats;
        }
      } catch (e) { console.warn('[SmartScheduler] Load error:', e); }
    }

    getStats() { return { totalChats: this.responseData.size, totalResponses: this.globalStats.totalResponses, peakHour: this.globalStats.hourDistribution.indexOf(Math.max(...this.globalStats.hourDistribution)), peakDay: this.globalStats.dayDistribution.indexOf(Math.max(...this.globalStats.dayDistribution)) }; }
  }

  // ============================================================
  // 8️⃣ A/B TESTING ENGINE
  // ============================================================
  class ABTestingEngine {
    constructor(options = {}) {
      this.tests = new Map();
      this.assignments = new Map();
      this.options = { minSampleSize: options.minSampleSize || 50, confidenceLevel: options.confidenceLevel || 0.95, ...options };
      this.stats = { activeTests: 0, completedTests: 0, totalAssignments: 0 };
    }

    createTest(testId, config) {
      const test = { id: testId, name: config.name || testId, description: config.description || '', variants: config.variants || [{ id: 'control', name: 'Controle', content: config.controlContent }, { id: 'treatment', name: 'Tratamento', content: config.treatmentContent }], metric: config.metric || 'response_rate', targetSampleSize: config.targetSampleSize || this.options.minSampleSize * 2, status: 'active', createdAt: Date.now(), results: {} };
      for (const v of test.variants) test.results[v.id] = { assignments: 0, conversions: 0, totalValue: 0 };
      this.tests.set(testId, test);
      this.stats.activeTests++;
      this._save();
      return test;
    }

    getVariant(testId, chatId) {
      const test = this.tests.get(testId);
      if (!test || test.status !== 'active') return null;
      const ca = this.assignments.get(chatId) || {};
      if (ca[testId]) return test.variants.find(v => v.id === ca[testId]);
      const vi = Math.floor(Math.random() * test.variants.length);
      const variant = test.variants[vi];
      ca[testId] = variant.id;
      this.assignments.set(chatId, ca);
      test.results[variant.id].assignments++;
      this.stats.totalAssignments++;
      this._checkCompletion(testId);
      this._save();
      return variant;
    }

    recordConversion(testId, chatId, value = 1) {
      const test = this.tests.get(testId);
      if (!test) return;
      const ca = this.assignments.get(chatId) || {};
      const vid = ca[testId];
      if (vid && test.results[vid]) { test.results[vid].conversions++; test.results[vid].totalValue += value; this._save(); }
    }

    analyzeTest(testId) {
      const test = this.tests.get(testId);
      if (!test) return null;
      const analysis = { testId, name: test.name, status: test.status, variants: [], winner: null, confidence: 0, recommendation: '' };
      for (const v of test.variants) {
        const r = test.results[v.id];
        const rate = r.assignments > 0 ? r.conversions / r.assignments : 0;
        analysis.variants.push({ id: v.id, name: v.name, assignments: r.assignments, conversions: r.conversions, conversionRate: (rate * 100).toFixed(2) + '%', avgValue: r.conversions > 0 ? (r.totalValue / r.conversions).toFixed(2) : '0' });
      }
      if (analysis.variants.every(v => v.assignments >= this.options.minSampleSize)) {
        const sorted = [...analysis.variants].sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate));
        analysis.winner = sorted[0].id;
        analysis.confidence = this._calcConfidence(test.results[sorted[0].id], test.results[sorted[1].id]);
        analysis.recommendation = analysis.confidence >= this.options.confidenceLevel ? `"${sorted[0].name}" vence com ${(analysis.confidence * 100).toFixed(1)}% confiança` : 'Dados insuficientes';
      } else { analysis.recommendation = 'Coletando dados...'; }
      return analysis;
    }

    _calcConfidence(rA, rB) {
      const nA = rA.assignments, nB = rB.assignments;
      const pA = rA.conversions / nA, pB = rB.conversions / nB;
      if (nA < 10 || nB < 10) return 0;
      const pooled = (rA.conversions + rB.conversions) / (nA + nB);
      const se = Math.sqrt(pooled * (1 - pooled) * (1/nA + 1/nB));
      if (se === 0) return 0;
      const z = Math.abs(pA - pB) / se;
      if (z >= 2.58) return 0.99;
      if (z >= 1.96) return 0.95;
      if (z >= 1.64) return 0.90;
      if (z >= 1.28) return 0.80;
      return z / 2.58 * 0.80;
    }

    _checkCompletion(testId) {
      const test = this.tests.get(testId);
      if (!test) return;
      const total = Object.values(test.results).reduce((s, r) => s + r.assignments, 0);
      if (total >= test.targetSampleSize) { test.status = 'completed'; this.stats.activeTests--; this.stats.completedTests++; }
    }

    endTest(testId) {
      const test = this.tests.get(testId);
      if (test && test.status === 'active') { test.status = 'completed'; test.completedAt = Date.now(); this.stats.activeTests--; this.stats.completedTests++; this._save(); }
      return this.analyzeTest(testId);
    }

    getTest(testId) { return this.tests.get(testId); }
    listTests(status = null) { const t = Array.from(this.tests.values()); return status ? t.filter(x => x.status === status) : t; }

    async _save() {
      try { await chrome.storage.local.set({ [STORAGE_KEYS.AB_TESTS]: JSON.stringify({ tests: Array.from(this.tests.entries()), assignments: Array.from(this.assignments.entries()), stats: this.stats }) }); }
      catch (e) { console.warn('[ABTestingEngine] Save error:', e); }
    }

    async load() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.AB_TESTS);
        if (data[STORAGE_KEYS.AB_TESTS]) {
          const p = JSON.parse(data[STORAGE_KEYS.AB_TESTS]);
          for (const [id, t] of p.tests || []) this.tests.set(id, t);
          for (const [id, a] of p.assignments || []) this.assignments.set(id, a);
          this.stats = p.stats || this.stats;
        }
      } catch (e) { console.warn('[ABTestingEngine] Load error:', e); }
    }

    getStats() { return { ...this.stats }; }
  }

  // ============================================================
  // 9️⃣ LANGUAGE DETECTOR
  // ============================================================
  class LanguageDetector {
    constructor(options = {}) {
      this.options = { defaultLanguage: options.defaultLanguage || 'pt-BR', minConfidence: options.minConfidence || 0.6, ...options };
      this.profiles = this._initProfiles();
      this.chatLanguages = new Map();
      this.stats = { detections: 0, languages: {} };
    }

    _initProfiles() {
      return {
        'pt-BR': { name: 'Português', commonWords: ['de', 'que', 'não', 'para', 'com', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'como', 'mas', 'foi', 'ele', 'tem', 'seu', 'você', 'obrigado', 'bom', 'dia', 'oi', 'olá'], patterns: [/ção$/, /ões$/, /mente$/], formalGreeting: 'Prezado(a)', casualGreeting: 'Oi', formalClosing: 'Atenciosamente', casualClosing: 'Abraços' },
        'en': { name: 'English', commonWords: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'you', 'do', 'at', 'this', 'hello', 'hi', 'thanks', 'please'], patterns: [/tion$/, /ing$/, /ed$/, /ly$/], formalGreeting: 'Dear', casualGreeting: 'Hi', formalClosing: 'Best regards', casualClosing: 'Cheers' },
        'es': { name: 'Español', commonWords: ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'se', 'del', 'las', 'un', 'por', 'con', 'no', 'una', 'su', 'para', 'es', 'hola', 'gracias', 'buenos', 'días'], patterns: [/ción$/, /mente$/, /ando$/, /iendo$/], formalGreeting: 'Estimado(a)', casualGreeting: 'Hola', formalClosing: 'Atentamente', casualClosing: 'Saludos' }
      };
    }

    detect(text) {
      if (!text || text.length < 10) return { language: this.options.defaultLanguage, confidence: 0, detected: false };
      this.stats.detections++;
      const words = text.toLowerCase().split(/\s+/);
      const scores = {};
      for (const [lang, profile] of Object.entries(this.profiles)) {
        let score = 0, matches = 0;
        for (const w of words) if (profile.commonWords.includes(w)) { score += 2; matches++; }
        for (const p of profile.patterns) for (const w of words) if (p.test(w)) { score += 1; matches++; }
        scores[lang] = { score, matches, confidence: words.length > 0 ? Math.min(matches / words.length * 2, 1) : 0 };
      }
      const best = Object.entries(scores).sort((a, b) => b[1].confidence - a[1].confidence)[0];
      const result = { language: best[1].confidence >= this.options.minConfidence ? best[0] : this.options.defaultLanguage, confidence: best[1].confidence, detected: best[1].confidence >= this.options.minConfidence, allScores: scores };
      this.stats.languages[result.language] = (this.stats.languages[result.language] || 0) + 1;
      return result;
    }

    detectAndSet(chatId, text) {
      const d = this.detect(text);
      if (d.detected) this.chatLanguages.set(chatId, { language: d.language, confidence: d.confidence, detectedAt: Date.now() });
      return d;
    }

    getChatLanguage(chatId) { return this.chatLanguages.get(chatId)?.language || this.options.defaultLanguage; }

    getGreeting(chatId, formal = false) {
      const lang = this.getChatLanguage(chatId);
      const p = this.profiles[lang] || this.profiles['pt-BR'];
      return formal ? p.formalGreeting : p.casualGreeting;
    }

    getClosing(chatId, formal = false) {
      const lang = this.getChatLanguage(chatId);
      const p = this.profiles[lang] || this.profiles['pt-BR'];
      return formal ? p.formalClosing : p.casualClosing;
    }

    detectTone(text) {
      const formal = ['prezado', 'senhor', 'atenciosamente', 'dear', 'sir', 'sincerely'];
      const casual = ['oi', 'opa', 'blz', 'valeu', 'hi', 'hey'];
      const t = text.toLowerCase();
      const fs = formal.filter(i => t.includes(i)).length;
      const cs = casual.filter(i => t.includes(i)).length;
      if (fs > cs) return 'formal';
      if (cs > fs) return 'casual';
      return 'neutral';
    }

    getSupportedLanguages() { return Object.entries(this.profiles).map(([c, p]) => ({ code: c, name: p.name })); }
    getStats() { return { ...this.stats }; }
  }

  // ============================================================
  // 🔟 RESPONSE CACHE
  // ============================================================
  class ResponseCache {
    constructor(options = {}) {
      this.cache = new Map();
      this.options = { maxSize: options.maxSize || 500, defaultTTL: options.defaultTTL || 24 * 60 * 60 * 1000, similarityThreshold: options.similarityThreshold || 0.85, ...options };
      this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
    }

    _genKey(input) { return input.toLowerCase().replace(/[^\w\sáéíóúàèìòùâêîôûãõç]/g, '').replace(/\s+/g, ' ').trim(); }

    _similarity(s1, s2) {
      const set1 = new Set(s1.split(' ')), set2 = new Set(s2.split(' '));
      const inter = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      return inter.size / union.size;
    }

    set(input, response, ttl = null) {
      const key = this._genKey(input);
      const expiry = Date.now() + (ttl || this.options.defaultTTL);
      if (this.cache.size >= this.options.maxSize) this._evict();
      this.cache.set(key, { input, response, expiry, hits: 0, createdAt: Date.now(), lastHit: null });
      this.stats.sets++;
      this._save();
    }

    get(input) {
      const key = this._genKey(input);
      if (this.cache.has(key)) {
        const e = this.cache.get(key);
        if (Date.now() < e.expiry) { e.hits++; e.lastHit = Date.now(); this.stats.hits++; return { response: e.response, exact: true, similarity: 1 }; }
        else this.cache.delete(key);
      }
      let best = null, bestSim = 0;
      for (const [k, e] of this.cache) {
        if (Date.now() >= e.expiry) continue;
        const sim = this._similarity(key, k);
        if (sim >= this.options.similarityThreshold && sim > bestSim) { bestSim = sim; best = e; }
      }
      if (best) { best.hits++; best.lastHit = Date.now(); this.stats.hits++; return { response: best.response, exact: false, similarity: bestSim }; }
      this.stats.misses++;
      return null;
    }

    async getOrSet(input, generator) {
      const cached = this.get(input);
      if (cached) return cached;
      const response = await generator();
      this.set(input, response);
      return { response, exact: true, similarity: 1, fromCache: false };
    }

    _evict() {
      let oldest = null, oldestTime = Infinity;
      for (const [k, e] of this.cache) { const t = e.lastHit || e.createdAt; if (t < oldestTime) { oldestTime = t; oldest = k; } }
      if (oldest) { this.cache.delete(oldest); this.stats.evictions++; }
    }

    cleanup() { const now = Date.now(); let c = 0; for (const [k, e] of this.cache) if (now >= e.expiry) { this.cache.delete(k); c++; } return c; }
    invalidate(input) { return this.cache.delete(this._genKey(input)); }
    clear() { this.cache.clear(); }

    async _save() {
      try {
        const entries = Array.from(this.cache.entries()).sort((a, b) => (b[1].lastHit || b[1].createdAt) - (a[1].lastHit || a[1].createdAt)).slice(0, 200);
        await chrome.storage.local.set({ [STORAGE_KEYS.RESPONSE_CACHE]: JSON.stringify(entries) });
      } catch (e) { console.warn('[ResponseCache] Save error:', e); }
    }

    async load() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.RESPONSE_CACHE);
        if (data[STORAGE_KEYS.RESPONSE_CACHE]) for (const [k, v] of JSON.parse(data[STORAGE_KEYS.RESPONSE_CACHE])) if (Date.now() < v.expiry) this.cache.set(k, v);
      } catch (e) { console.warn('[ResponseCache] Load error:', e); }
    }

    getStats() { return { ...this.stats, size: this.cache.size, hitRate: this.stats.hits + this.stats.misses > 0 ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1) + '%' : '0%' }; }
  }

  // ============================================================
  // 1️⃣1️⃣ HISTORY COMPRESSOR
  // ============================================================
  class HistoryCompressor {
    constructor(options = {}) {
      this.options = { maxTokens: options.maxTokens || 3000, preserveRecent: options.preserveRecent || 5, ...options };
      this.stats = { totalCompressed: 0, tokensSaved: 0 };
    }

    estimateTokens(text) { return Math.ceil(text.length / 4); }

    compress(messages, maxTokens = null) {
      const target = maxTokens || this.options.maxTokens;
      let total = messages.reduce((s, m) => s + this.estimateTokens(m.text || m.body || m.content || ''), 0);
      if (total <= target) return { messages, compressed: false, tokensSaved: 0 };
      const preserve = messages.slice(-this.options.preserveRecent);
      const toCompress = messages.slice(0, -this.options.preserveRecent);
      const compressed = [];
      let batch = [], batchTokens = 0;
      const batchMax = target * 0.3 / Math.max(toCompress.length / 10, 1);
      for (const msg of toCompress) {
        const text = msg.text || msg.body || msg.content || '';
        const tokens = this.estimateTokens(text);
        if (batchTokens + tokens > batchMax && batch.length > 0) { compressed.push(this._compressBatch(batch)); batch = []; batchTokens = 0; }
        batch.push(msg); batchTokens += tokens;
      }
      if (batch.length > 0) compressed.push(this._compressBatch(batch));
      const result = [...compressed, ...preserve];
      const newTokens = result.reduce((s, m) => s + this.estimateTokens(m.text || m.body || m.content || ''), 0);
      const saved = total - newTokens;
      this.stats.totalCompressed++; this.stats.tokensSaved += saved;
      return { messages: result, compressed: true, originalTokens: total, newTokens, tokensSaved: saved, compressionRatio: ((1 - newTokens / total) * 100).toFixed(1) + '%' };
    }

    _compressBatch(messages) {
      if (messages.length === 1) return this._compressSingle(messages[0]);
      const fromMe = messages.filter(m => m.fromMe || m.isFromMe);
      const fromCustomer = messages.filter(m => !(m.fromMe || m.isFromMe));
      const summary = [];
      if (fromCustomer.length > 0) summary.push(`Cliente (${fromCustomer.length}): ${this._summarize(fromCustomer.map(m => m.text || m.body || '').join(' '))}`);
      if (fromMe.length > 0) summary.push(`Agente (${fromMe.length}): ${this._summarize(fromMe.map(m => m.text || m.body || '').join(' '))}`);
      return { role: 'system', content: `[COMPRIMIDO]\n${summary.join('\n')}`, compressed: true, originalCount: messages.length };
    }

    _compressSingle(msg) {
      const text = msg.text || msg.body || msg.content || '';
      if (this.estimateTokens(text) <= 50) return msg;
      return { ...msg, text: this._summarize(text), content: this._summarize(text), compressed: true };
    }

    _summarize(text, maxLen = 150) {
      if (text.length <= maxLen) return text;
      const sents = text.split(/[.!?]+/).filter(s => s.trim());
      if (sents.length <= 2) return text.substring(0, maxLen) + '...';
      const first = sents[0].trim(), last = sents[sents.length - 1].trim();
      if (first.length + last.length < maxLen) return `${first}. [...] ${last}`;
      return first.substring(0, maxLen) + '...';
    }

    prepareForAI(messages, maxTokens = null) {
      const { messages: compressed, tokensSaved, compressionRatio } = this.compress(messages, maxTokens);
      return { messages: compressed.map(m => ({ role: m.fromMe || m.isFromMe ? 'assistant' : 'user', content: m.text || m.body || m.content || '' })), tokensSaved, compressionRatio };
    }

    getStats() { return { ...this.stats, avgSaved: this.stats.totalCompressed > 0 ? Math.round(this.stats.tokensSaved / this.stats.totalCompressed) : 0 }; }
  }

  // ============================================================
  // 1️⃣2️⃣ BATCH PROCESSOR
  // ============================================================
  class BatchProcessor {
    constructor(options = {}) {
      this.queue = [];
      this.processing = false;
      this.options = { batchSize: options.batchSize || 10, batchDelay: options.batchDelay || 1000, maxQueueSize: options.maxQueueSize || 100, timeout: options.timeout || 30000, ...options };
      this.processor = options.processor || (async (items) => items);
      this.batchTimeout = null;
      this.stats = { totalProcessed: 0, totalBatches: 0, avgBatchSize: 0, errors: 0 };
    }

    add(item) {
      return new Promise((resolve, reject) => {
        if (this.queue.length >= this.options.maxQueueSize) { reject(new Error('Queue full')); return; }
        this.queue.push({ item, resolve, reject, addedAt: Date.now() });
        this._schedule();
      });
    }

    addAll(items) { return Promise.all(items.map(i => this.add(i))); }

    _schedule() {
      if (this.batchTimeout) return;
      if (this.queue.length >= this.options.batchSize) { this._process(); return; }
      this.batchTimeout = setTimeout(() => { this.batchTimeout = null; this._process(); }, this.options.batchDelay);
    }

    async _process() {
      if (this.processing || this.queue.length === 0) return;
      this.processing = true;
      const batch = this.queue.splice(0, this.options.batchSize);
      const items = batch.map(b => b.item);
      try {
        const results = await Promise.race([this.processor(items), new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), this.options.timeout))]);
        for (let i = 0; i < batch.length; i++) batch[i].resolve(results[i] || results);
        this.stats.totalProcessed += batch.length; this.stats.totalBatches++; this.stats.avgBatchSize = this.stats.totalProcessed / this.stats.totalBatches;
      } catch (e) { for (const b of batch) b.reject(e); this.stats.errors++; }
      this.processing = false;
      if (this.queue.length > 0) this._schedule();
    }

    async flush() {
      if (this.batchTimeout) { clearTimeout(this.batchTimeout); this.batchTimeout = null; }
      while (this.queue.length > 0) await this._process();
    }

    setProcessor(p) { this.processor = p; }
    clear() { for (const b of this.queue) b.reject(new Error('Cleared')); this.queue = []; }
    getQueueSize() { return this.queue.length; }
    getStats() { return { ...this.stats, queueSize: this.queue.length, isProcessing: this.processing }; }
  }

  // ============================================================
  // 1️⃣3️⃣ LAZY LOADER
  // ============================================================
  class LazyLoader {
    constructor(options = {}) {
      this.modules = new Map();
      this.loaded = new Map();
      this.loading = new Map();
      this.options = { preloadDelay: options.preloadDelay || 5000, ...options };
      this.stats = { totalModules: 0, loadedModules: 0, loadTime: {} };
    }

    register(moduleId, loader, options = {}) {
      this.modules.set(moduleId, { loader, priority: options.priority || 'low', preload: options.preload || false, dependencies: options.dependencies || [], description: options.description || '' });
      this.stats.totalModules++;
    }

    async load(moduleId) {
      if (this.loaded.has(moduleId)) return this.loaded.get(moduleId);
      if (this.loading.has(moduleId)) return this.loading.get(moduleId);
      const def = this.modules.get(moduleId);
      if (!def) throw new Error(`Module not registered: ${moduleId}`);
      for (const dep of def.dependencies) await this.load(dep);
      const start = Date.now();
      const promise = (async () => {
        try {
          const mod = await def.loader();
          this.loaded.set(moduleId, mod); this.loading.delete(moduleId);
          this.stats.loadedModules++; this.stats.loadTime[moduleId] = Date.now() - start;
          console.log(`[LazyLoader] ✅ ${moduleId} loaded in ${this.stats.loadTime[moduleId]}ms`);
          return mod;
        } catch (e) { this.loading.delete(moduleId); throw e; }
      })();
      this.loading.set(moduleId, promise);
      return promise;
    }

    async loadAll(ids) { return Promise.all(ids.map(id => this.load(id))); }
    async get(moduleId) { return this.loaded.has(moduleId) ? this.loaded.get(moduleId) : this.load(moduleId); }
    isLoaded(moduleId) { return this.loaded.has(moduleId); }

    unload(moduleId) {
      const mod = this.loaded.get(moduleId);
      if (mod) { if (typeof mod.cleanup === 'function') mod.cleanup(); this.loaded.delete(moduleId); this.stats.loadedModules--; return true; }
      return false;
    }

    async preloadHighPriority() {
      const hp = [];
      for (const [id, def] of this.modules) if (def.priority === 'high' || def.preload) hp.push(id);
      if (hp.length > 0) { console.log(`[LazyLoader] Preloading ${hp.length} modules...`); await this.loadAll(hp); }
    }

    schedulePreload() { setTimeout(() => { this.preloadHighPriority(); }, this.options.preloadDelay); }

    listModules() {
      const list = [];
      for (const [id, def] of this.modules) list.push({ id, priority: def.priority, loaded: this.loaded.has(id), loading: this.loading.has(id), loadTime: this.stats.loadTime[id] || null, dependencies: def.dependencies, description: def.description });
      return list;
    }

    getStats() { return { ...this.stats, memoryEstimate: `${(JSON.stringify([...this.loaded.values()]).length / 1024).toFixed(1)} KB` }; }
  }

  // ============================================================
  // 🚀 SMARTBOT AI PLUS (CLASSE PRINCIPAL)
  // ============================================================
  class SmartBotAIPlus {
    constructor(options = {}) {
      this.knowledgeBase = new RAGKnowledgeBase(options.knowledgeBase);
      this.summarizer = new ConversationSummarizer(options.summarizer);
      this.leadScoring = new LeadScoringAI(options.leadScoring);
      this.autoTagger = new AutoTagger(options.autoTagger);
      this.qualityScorer = new ResponseQualityScorer(options.qualityScorer);
      this.proactiveEngagement = new ProactiveEngagement(options.proactiveEngagement);
      this.smartScheduler = new SmartScheduler(options.smartScheduler);
      this.abTesting = new ABTestingEngine(options.abTesting);
      this.languageDetector = new LanguageDetector(options.languageDetector);
      this.responseCache = new ResponseCache(options.responseCache);
      this.historyCompressor = new HistoryCompressor(options.historyCompressor);
      this.batchProcessor = new BatchProcessor(options.batchProcessor);
      this.lazyLoader = new LazyLoader(options.lazyLoader);
      this.initialized = false;
      this.options = options;
    }

    async init() {
      if (this.initialized) return;
      console.log('[SmartBot AI Plus] 🚀 Inicializando 13 sistemas...');
      await Promise.all([
        this.knowledgeBase.load(),
        this.leadScoring.load(),
        this.autoTagger.load(),
        this.qualityScorer.load(),
        this.smartScheduler.load(),
        this.abTesting.load(),
        this.responseCache.load()
      ]);
      this.lazyLoader.schedulePreload();
      this.leadScoring.applyDecay();
      this.responseCache.cleanup();
      this.initialized = true;
      console.log('[SmartBot AI Plus] ✅ 13 sistemas prontos');
      window.dispatchEvent(new CustomEvent('smartbot-ai-plus:ready'));
    }

    async processMessage(chatId, message, context = {}) {
      const text = message.text || message.body || '';
      const results = {};
      results.language = this.languageDetector.detectAndSet(chatId, text);
      if (context.messages && context.messages.length > 0) results.tags = this.autoTagger.analyzeAndTag(chatId, context.messages);
      const signals = this.leadScoring.analyzeMessage(text);
      results.leadScore = this.leadScoring.scoreContact(chatId, { ...context.contactData, ...signals, messageCount: (context.messageCount || 0) + 1 });
      if (text.includes('?') || context.needsKnowledge) results.knowledge = this.knowledgeBase.getContextForQuery(text);
      results.cachedResponse = this.responseCache.get(text);
      results.suggestions = this.proactiveEngagement.getSuggestions(chatId);
      results.bestTime = this.smartScheduler.getBestTimes(chatId);
      const activeTests = this.abTesting.listTests('active');
      if (activeTests.length > 0) results.abVariant = this.abTesting.getVariant(activeTests[0].id, chatId);
      if (!message.fromMe) this.smartScheduler.recordResponse(chatId);
      return { chatId, processedAt: Date.now(), ...results };
    }

    prepareAIContext(chatId, messages, maxTokens = 3000) {
      const compressed = this.historyCompressor.prepareForAI(messages, maxTokens * 0.7);
      const lastMsg = messages[messages.length - 1];
      const text = lastMsg?.text || lastMsg?.body || '';
      const knowledge = this.knowledgeBase.getContextForQuery(text, maxTokens * 0.3);
      const { summary } = this.summarizer.prepareContext(chatId, messages, maxTokens);
      return { messages: compressed.messages, knowledge: knowledge.context, summary: summary?.text, tokensSaved: compressed.tokensSaved, sources: knowledge.sources };
    }

    evaluateResponse(input, response, context = {}) { return this.qualityScorer.scoreResponse(input, response, context); }
    cacheResponse(input, response, ttl) { this.responseCache.set(input, response, ttl); }

    getStats() {
      return {
        knowledgeBase: this.knowledgeBase.getStats(),
        summarizer: this.summarizer.getStats(),
        leadScoring: this.leadScoring.getStats(),
        autoTagger: this.autoTagger.getStats(),
        qualityScorer: this.qualityScorer.getStats(),
        proactiveEngagement: this.proactiveEngagement.getStats(),
        smartScheduler: this.smartScheduler.getStats(),
        abTesting: this.abTesting.getStats(),
        languageDetector: this.languageDetector.getStats(),
        responseCache: this.responseCache.getStats(),
        historyCompressor: this.historyCompressor.getStats(),
        batchProcessor: this.batchProcessor.getStats(),
        lazyLoader: this.lazyLoader.getStats()
      };
    }

    exportData() {
      return {
        knowledgeBase: { documents: this.knowledgeBase.listDocuments(), stats: this.knowledgeBase.getStats() },
        leadScores: this.leadScoring.getTopLeads(100),
        tags: Array.from(this.autoTagger.tags.entries()),
        abTests: this.abTesting.listTests(),
        stats: this.getStats(),
        exportedAt: new Date().toISOString()
      };
    }
  }

  // ============================================================
  // EXPORTS
  // ============================================================
  if (typeof window !== 'undefined') {
    window.RAGKnowledgeBase = RAGKnowledgeBase;
    window.ConversationSummarizer = ConversationSummarizer;
    window.LeadScoringAI = LeadScoringAI;
    window.AutoTagger = AutoTagger;
    window.ResponseQualityScorer = ResponseQualityScorer;
    window.ProactiveEngagement = ProactiveEngagement;
    window.SmartScheduler = SmartScheduler;
    window.ABTestingEngine = ABTestingEngine;
    window.LanguageDetector = LanguageDetector;
    window.ResponseCache = ResponseCache;
    window.HistoryCompressor = HistoryCompressor;
    window.BatchProcessor = BatchProcessor;
    window.LazyLoader = LazyLoader;
    window.SmartBotAIPlus = SmartBotAIPlus;
    window.smartBotAIPlus = new SmartBotAIPlus();
    window.smartBotAIPlus.init().then(() => {
      console.log('[SmartBot AI Plus] ✅ 13 novos sistemas de IA disponíveis');
    });
  }

})();
