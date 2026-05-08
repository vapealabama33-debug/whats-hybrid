/**
 * 📈 Sentiment Tracker - Análise de Sentimento em Tempo Real
 * Monitora sentimento durante conversas e detecta pontos críticos
 * 
 * @version 1.0.0
 */

class SentimentTracker {
  constructor() {
    this.conversations = new Map();
    this.alerts = [];
    this.history = [];
    this.config = {
      negativeThreshold: -0.3,
      positiveThreshold: 0.3,
      alertCooldown: 60000, // 1 minuto entre alertas do mesmo chat
      trendWindow: 5 // últimas 5 mensagens para tendência
    };

    // Dicionário de sentimento em português
    this.sentimentDict = {
      positive: [
        'obrigado', 'obrigada', 'agradeço', 'perfeito', 'excelente', 'ótimo', 'otimo',
        'maravilhoso', 'incrível', 'adorei', 'amei', 'top', 'show', 'legal', 'bom',
        'gostei', 'satisfeito', 'feliz', 'parabéns', 'recomendo', 'melhor'
      ],
      negative: [
        'ruim', 'péssimo', 'pessimo', 'horrível', 'terrível', 'lixo', 'porcaria',
        'decepcionado', 'frustrado', 'irritado', 'bravo', 'raiva', 'ódio', 'odio',
        'nunca mais', 'absurdo', 'vergonha', 'inaceitável', 'reclamação', 'problema',
        'demora', 'atrasado', 'caro', 'roubo'
      ],
      intensifiers: ['muito', 'demais', 'extremamente', 'super', 'mega', 'totalmente'],
      negators: ['não', 'nao', 'nunca', 'nem', 'jamais']
    };
  }

  // ============================================
  // ANÁLISE DE SENTIMENTO
  // ============================================

  /**
   * Analisa sentimento de uma mensagem
   */
  analyze(text) {
    const normalizedText = this.normalizeText(text);
    const words = normalizedText.split(/\s+/);
    
    let score = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let hasNegator = false;
    let hasIntensifier = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const prevWord = words[i - 1] || '';

      // Verificar negador
      if (this.sentimentDict.negators.includes(word)) {
        hasNegator = true;
        continue;
      }

      // Verificar intensificador
      if (this.sentimentDict.intensifiers.includes(word)) {
        hasIntensifier = true;
        continue;
      }

      // Calcular score
      let wordScore = 0;
      
      if (this.sentimentDict.positive.includes(word)) {
        wordScore = 0.3;
        positiveCount++;
      } else if (this.sentimentDict.negative.includes(word)) {
        wordScore = -0.4;
        negativeCount++;
      }

      // Aplicar modificadores
      if (wordScore !== 0) {
        if (hasNegator) {
          wordScore *= -0.8; // Inverter e reduzir
          hasNegator = false;
        }
        if (hasIntensifier) {
          wordScore *= 1.5;
          hasIntensifier = false;
        }
      }

      score += wordScore;
    }

    // Normalizar score entre -1 e 1
    score = Math.max(-1, Math.min(1, score));

    return {
      score,
      label: this.getLabel(score),
      positiveCount,
      negativeCount,
      confidence: Math.abs(score) > 0.2 ? 'high' : 'medium'
    };
  }

  /**
   * Normaliza texto para análise
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Obtém label baseado no score
   */
  getLabel(score) {
    if (score >= this.config.positiveThreshold) return 'positive';
    if (score <= this.config.negativeThreshold) return 'negative';
    return 'neutral';
  }

  // ============================================
  // TRACKING DE CONVERSAS
  // ============================================

  /**
   * Registra mensagem de uma conversa
   */
  trackMessage(chatId, message, isClient = true) {
    const analysis = this.analyze(message);
    
    if (!this.conversations.has(chatId)) {
      this.conversations.set(chatId, {
        chatId,
        messages: [],
        overallSentiment: 0,
        sentimentHistory: [],
        alerts: [],
        startedAt: Date.now()
      });
    }

    const conv = this.conversations.get(chatId);
    
    const entry = {
      id: `msg_${Date.now()}`,
      content: message.substring(0, 200),
      isClient,
      analysis,
      timestamp: Date.now()
    };

    conv.messages.push(entry);
    conv.sentimentHistory.push(analysis.score);

    // Atualizar sentimento geral
    conv.overallSentiment = this.calculateOverallSentiment(conv.sentimentHistory);

    // Detectar mudanças críticas
    this.detectCriticalChanges(chatId, conv);

    // Adicionar ao histórico global
    this.history.push({
      chatId,
      ...entry
    });

    return {
      ...analysis,
      overallSentiment: conv.overallSentiment,
      trend: this.getTrend(conv.sentimentHistory)
    };
  }

  /**
   * Calcula sentimento geral da conversa
   */
  calculateOverallSentiment(history) {
    if (history.length === 0) return 0;
    
    // Peso maior para mensagens recentes
    let weightedSum = 0;
    let totalWeight = 0;
    
    history.forEach((score, index) => {
      const weight = 1 + (index / history.length); // Mais recente = mais peso
      weightedSum += score * weight;
      totalWeight += weight;
    });

    return weightedSum / totalWeight;
  }

  /**
   * Calcula tendência de sentimento
   */
  getTrend(history) {
    if (history.length < 3) return 'insufficient_data';
    
    const recent = history.slice(-this.config.trendWindow);
    const older = history.slice(-this.config.trendWindow * 2, -this.config.trendWindow);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    
    if (diff > 0.15) return 'improving';
    if (diff < -0.15) return 'declining';
    return 'stable';
  }

  // ============================================
  // ALERTAS
  // ============================================

  /**
   * Detecta mudanças críticas de sentimento
   */
  detectCriticalChanges(chatId, conv) {
    const lastAlert = conv.alerts[conv.alerts.length - 1];
    const now = Date.now();
    
    // Verificar cooldown
    if (lastAlert && (now - lastAlert.timestamp) < this.config.alertCooldown) {
      return;
    }

    const history = conv.sentimentHistory;
    const lastScore = history[history.length - 1];
    const prevScore = history[history.length - 2];

    // Alerta: Cliente ficou negativo de repente
    if (lastScore < -0.4 && prevScore > -0.2) {
      this.createAlert(chatId, conv, {
        type: 'sudden_negative',
        severity: 'high',
        message: 'Cliente demonstrou insatisfação súbita',
        suggestion: 'Ofereça ajuda imediata e demonstre empatia',
        score: lastScore
      });
    }

    // Alerta: Tendência negativa contínua
    if (history.length >= 3) {
      const lastThree = history.slice(-3);
      const allNegative = lastThree.every(s => s < -0.2);
      const declining = lastThree[2] < lastThree[1] && lastThree[1] < lastThree[0];
      
      if (allNegative && declining) {
        this.createAlert(chatId, conv, {
          type: 'declining_sentiment',
          severity: 'medium',
          message: 'Sentimento em declínio contínuo',
          suggestion: 'Tente resolver o problema ou escalar para humano',
          score: lastScore
        });
      }
    }

    // Alerta: Recuperação de sentimento
    if (lastScore > 0.3 && prevScore < -0.2) {
      this.createAlert(chatId, conv, {
        type: 'recovery',
        severity: 'info',
        message: 'Sentimento do cliente recuperou!',
        suggestion: 'Aproveite para oferecer algo extra',
        score: lastScore
      });
    }
  }

  /**
   * Cria um alerta
   */
  createAlert(chatId, conv, alertData) {
    const alert = {
      id: `alert_${Date.now()}`,
      chatId,
      ...alertData,
      timestamp: Date.now()
    };

    conv.alerts.push(alert);
    this.alerts.push(alert);

    // Emitir evento
    if (window.EventBus) {
      window.EventBus.emit('sentiment:alert', alert);
    }

    console.log('[SentimentTracker] 🚨 Alerta:', alert);

    return alert;
  }

  // ============================================
  // MÉTRICAS E ANÁLISE
  // ============================================

  /**
   * Obtém resumo de uma conversa
   */
  getConversationSummary(chatId) {
    const conv = this.conversations.get(chatId);
    if (!conv) return null;

    const history = conv.sentimentHistory;
    
    return {
      chatId,
      messageCount: conv.messages.length,
      overallSentiment: conv.overallSentiment,
      sentimentLabel: this.getLabel(conv.overallSentiment),
      trend: this.getTrend(history),
      startSentiment: history[0] || 0,
      endSentiment: history[history.length - 1] || 0,
      lowestPoint: Math.min(...history),
      highestPoint: Math.max(...history),
      alertCount: conv.alerts.length,
      duration: Date.now() - conv.startedAt
    };
  }

  /**
   * Obtém métricas globais
   */
  getGlobalMetrics() {
    const allHistory = [];
    let totalConversations = 0;
    let positiveConversations = 0;
    let negativeConversations = 0;

    this.conversations.forEach(conv => {
      totalConversations++;
      allHistory.push(...conv.sentimentHistory);
      
      if (conv.overallSentiment > 0.2) positiveConversations++;
      else if (conv.overallSentiment < -0.2) negativeConversations++;
    });

    const avgSentiment = allHistory.length > 0
      ? allHistory.reduce((a, b) => a + b, 0) / allHistory.length
      : 0;

    return {
      totalConversations,
      totalMessages: allHistory.length,
      avgSentiment,
      avgSentimentLabel: this.getLabel(avgSentiment),
      positiveRate: totalConversations > 0 ? positiveConversations / totalConversations : 0,
      negativeRate: totalConversations > 0 ? negativeConversations / totalConversations : 0,
      alertCount: this.alerts.length,
      recentAlerts: this.alerts.slice(-10)
    };
  }

  /**
   * Obtém distribuição de sentimento
   */
  getSentimentDistribution() {
    const distribution = {
      positive: 0,
      neutral: 0,
      negative: 0
    };

    this.history.forEach(entry => {
      distribution[entry.analysis.label]++;
    });

    const total = this.history.length || 1;

    return {
      positive: distribution.positive / total,
      neutral: distribution.neutral / total,
      negative: distribution.negative / total,
      counts: distribution
    };
  }

  // ============================================
  // UTILS
  // ============================================

  /**
   * Obtém conversas problemáticas
   */
  getProblematicConversations() {
    const problematic = [];
    
    this.conversations.forEach((conv, chatId) => {
      if (conv.overallSentiment < -0.3 || conv.alerts.length >= 2) {
        problematic.push({
          chatId,
          overallSentiment: conv.overallSentiment,
          alertCount: conv.alerts.length,
          trend: this.getTrend(conv.sentimentHistory)
        });
      }
    });

    return problematic.sort((a, b) => a.overallSentiment - b.overallSentiment);
  }

  /**
   * Limpa dados antigos
   */
  cleanup(maxAge = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAge;
    
    this.conversations.forEach((conv, chatId) => {
      if (conv.startedAt < cutoff) {
        this.conversations.delete(chatId);
      }
    });

    this.history = this.history.filter(h => h.timestamp >= cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp >= cutoff);
  }
}

// Exportar
window.SentimentTracker = SentimentTracker;
window.sentimentTracker = new SentimentTracker();
console.log('[SentimentTracker] ✅ Módulo de análise de sentimento carregado');
