/**
 * 🎯 Gap Detector - Detecção Automática de Lacunas de Conhecimento
 * Identifica onde a IA não sabe responder ou tem baixa confiança
 * 
 * @version 1.0.0
 */

class GapDetector {
  constructor() {
    this.gaps = [];
    this.lowConfidenceResponses = [];
    this.unansweredQuestions = [];
    this.config = {
      confidenceThreshold: 0.6,
      minOccurrences: 2,
      clusterSimilarity: 0.7
    };
  }

  // ============================================
  // REGISTRO DE GAPS
  // ============================================

  /**
   * Registra uma resposta de baixa confiança
   */
  recordLowConfidence(data) {
    const {
      question,
      response,
      confidence,
      chatId,
      timestamp = Date.now()
    } = data;

    if (confidence >= this.config.confidenceThreshold) return;

    const entry = {
      id: `gap_${Date.now()}`,
      question,
      response,
      confidence,
      chatId,
      timestamp,
      category: this.detectCategory(question),
      intent: this.detectIntent(question),
      keywords: this.extractKeywords(question),
      clusterId: null
    };

    this.lowConfidenceResponses.push(entry);
    this.clusterGap(entry);

    console.log('[GapDetector] Registrada resposta de baixa confiança:', confidence);

    return entry;
  }

  /**
   * Registra uma pergunta sem resposta
   */
  recordUnanswered(question, context = {}) {
    const entry = {
      id: `unans_${Date.now()}`,
      question,
      timestamp: Date.now(),
      context,
      category: this.detectCategory(question),
      intent: this.detectIntent(question),
      keywords: this.extractKeywords(question),
      occurrences: 1
    };

    // Verificar se já existe similar
    const existing = this.findSimilarUnanswered(question);
    if (existing) {
      existing.occurrences++;
      existing.lastSeen = Date.now();
      return existing;
    }

    this.unansweredQuestions.push(entry);
    return entry;
  }

  /**
   * Registra feedback negativo
   */
  recordNegativeFeedback(data) {
    const {
      question,
      response,
      feedback,
      correction
    } = data;

    const entry = {
      id: `neg_${Date.now()}`,
      question,
      response,
      feedback,
      correction,
      timestamp: Date.now(),
      category: this.detectCategory(question),
      keywords: this.extractKeywords(question)
    };

    this.gaps.push(entry);
    return entry;
  }

  // ============================================
  // CLUSTERIZAÇÃO
  // ============================================

  /**
   * Agrupa gaps similares em clusters
   */
  clusterGap(entry) {
    // Encontrar cluster existente
    for (const gap of this.lowConfidenceResponses) {
      if (gap.clusterId && this.isSimilar(entry.question, gap.question)) {
        entry.clusterId = gap.clusterId;
        return;
      }
    }

    // Criar novo cluster
    entry.clusterId = `cluster_${Date.now()}`;
  }

  /**
   * Verifica similaridade entre duas perguntas
   */
  isSimilar(q1, q2) {
    const words1 = new Set(this.tokenize(q1));
    const words2 = new Set(this.tokenize(q2));
    
    const intersection = [...words1].filter(w => words2.has(w));
    const union = new Set([...words1, ...words2]);
    
    const jaccard = intersection.length / union.size;
    return jaccard >= this.config.clusterSimilarity;
  }

  /**
   * Encontra pergunta similar não respondida
   */
  findSimilarUnanswered(question) {
    return this.unansweredQuestions.find(u => this.isSimilar(u.question, question));
  }

  // ============================================
  // ANÁLISE
  // ============================================

  /**
   * Obtém gaps agrupados por cluster
   */
  getClusteredGaps() {
    const clusters = new Map();

    this.lowConfidenceResponses.forEach(entry => {
      if (!clusters.has(entry.clusterId)) {
        clusters.set(entry.clusterId, {
          id: entry.clusterId,
          entries: [],
          avgConfidence: 0,
          category: entry.category,
          keywords: new Set()
        });
      }

      const cluster = clusters.get(entry.clusterId);
      cluster.entries.push(entry);
      entry.keywords.forEach(k => cluster.keywords.add(k));
    });

    // Calcular média de confiança
    clusters.forEach(cluster => {
      cluster.avgConfidence = cluster.entries.reduce((sum, e) => sum + e.confidence, 0) / cluster.entries.length;
      cluster.keywords = [...cluster.keywords];
      cluster.representativeQuestion = cluster.entries[0].question;
      cluster.count = cluster.entries.length;
    });

    return Array.from(clusters.values()).sort((a, b) => a.avgConfidence - b.avgConfidence);
  }

  /**
   * Obtém perguntas não respondidas mais frequentes
   */
  getTopUnanswered(limit = 10) {
    return [...this.unansweredQuestions]
      .filter(u => u.occurrences >= this.config.minOccurrences)
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  /**
   * Obtém distribuição de gaps por categoria
   */
  getGapsByCategory() {
    const distribution = {};

    [...this.lowConfidenceResponses, ...this.unansweredQuestions, ...this.gaps]
      .forEach(entry => {
        const cat = entry.category || 'outros';
        if (!distribution[cat]) {
          distribution[cat] = { count: 0, avgConfidence: 0, examples: [] };
        }
        distribution[cat].count++;
        if (entry.confidence !== undefined) {
          distribution[cat].avgConfidence += entry.confidence;
        }
        if (distribution[cat].examples.length < 3) {
          distribution[cat].examples.push(entry.question);
        }
      });

    // Calcular médias
    Object.values(distribution).forEach(cat => {
      if (cat.avgConfidence > 0) {
        cat.avgConfidence /= cat.count;
      }
    });

    return distribution;
  }

  /**
   * Gera sugestões de melhoria
   */
  generateSuggestions() {
    const suggestions = [];
    const clustered = this.getClusteredGaps();
    const topUnanswered = this.getTopUnanswered(5);
    const byCategory = this.getGapsByCategory();

    // Sugestões baseadas em clusters
    clustered.slice(0, 5).forEach(cluster => {
      suggestions.push({
        type: 'cluster',
        priority: cluster.avgConfidence < 0.4 ? 'high' : 'medium',
        title: `Melhorar respostas sobre: ${cluster.keywords.slice(0, 3).join(', ')}`,
        description: `${cluster.count} perguntas com baixa confiança (${(cluster.avgConfidence * 100).toFixed(0)}%)`,
        action: 'add_examples',
        examples: cluster.entries.slice(0, 3).map(e => e.question)
      });
    });

    // Sugestões baseadas em não respondidas
    topUnanswered.forEach(u => {
      suggestions.push({
        type: 'unanswered',
        priority: u.occurrences >= 5 ? 'high' : 'medium',
        title: `Criar FAQ para: "${u.question.substring(0, 50)}..."`,
        description: `Perguntada ${u.occurrences} vezes sem resposta adequada`,
        action: 'add_faq',
        question: u.question
      });
    });

    // Sugestões por categoria
    Object.entries(byCategory)
      .filter(([, data]) => data.avgConfidence < 0.5 && data.count >= 3)
      .forEach(([category, data]) => {
        suggestions.push({
          type: 'category',
          priority: 'medium',
          title: `Reforçar categoria: ${category}`,
          description: `${data.count} gaps com confiança média de ${(data.avgConfidence * 100).toFixed(0)}%`,
          action: 'review_category',
          category,
          examples: data.examples
        });
      });

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // ============================================
  // UTILS
  // ============================================

  detectCategory(text) {
    const categories = {
      preco: /pre[çc]o|valor|custa|quanto/i,
      disponibilidade: /tem|dispon[íi]vel|estoque|entrega/i,
      suporte: /problema|erro|n[ãa]o funciona|ajuda/i,
      duvida: /como|onde|quando|qual|porque/i,
      compra: /comprar|pedido|pagar|pagamento/i,
      reclamacao: /reclama|insatisf|péssimo|horrível/i
    };

    for (const [cat, regex] of Object.entries(categories)) {
      if (regex.test(text)) return cat;
    }
    return 'geral';
  }

  detectIntent(text) {
    const intents = {
      question_price: /pre[çc]o|valor|custa|quanto/i,
      question_availability: /tem|dispon[íi]vel|estoque/i,
      how_to: /como fa[çz]|como posso/i,
      complaint: /reclama|problema/i,
      buy_intent: /quero comprar|vou levar/i
    };

    for (const [intent, regex] of Object.entries(intents)) {
      if (regex.test(text)) return intent;
    }
    return 'general';
  }

  extractKeywords(text) {
    const stopwords = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'em', 'um', 'uma', 'para', 'com', 'que', 'é', 'não', 'por', 'se']);
    return this.tokenize(text)
      .filter(w => w.length > 2 && !stopwords.has(w))
      .slice(0, 5);
  }

  tokenize(text) {
    return text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .split(/\W+/)
      .filter(w => w.length > 0);
  }

  // ============================================
  // GETTERS
  // ============================================

  getStats() {
    return {
      totalGaps: this.gaps.length,
      lowConfidenceCount: this.lowConfidenceResponses.length,
      unansweredCount: this.unansweredQuestions.length,
      clustersCount: new Set(this.lowConfidenceResponses.map(e => e.clusterId)).size,
      avgConfidence: this.lowConfidenceResponses.length > 0
        ? this.lowConfidenceResponses.reduce((sum, e) => sum + e.confidence, 0) / this.lowConfidenceResponses.length
        : 1
    };
  }

  clear() {
    this.gaps = [];
    this.lowConfidenceResponses = [];
    this.unansweredQuestions = [];
  }
}

// Exportar
window.GapDetector = GapDetector;
window.gapDetector = new GapDetector();
console.log('[GapDetector] ✅ Módulo de detecção de gaps carregado');
