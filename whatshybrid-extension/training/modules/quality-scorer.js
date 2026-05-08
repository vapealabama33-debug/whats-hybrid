/**
 * 📊 Quality Scorer - Score de Qualidade por Categoria
 * Métricas detalhadas de performance da IA por tipo de pergunta
 * 
 * @version 1.0.0
 */

class QualityScorer {
  constructor() {
    this.categories = new Map();
    this.history = [];
    this.thresholds = {
      excellent: 0.9,
      good: 0.75,
      acceptable: 0.6,
      poor: 0.4
    };
  }

  // ============================================
  // REGISTRO DE MÉTRICAS
  // ============================================

  /**
   * Registra uma interação para scoring
   */
  record(data) {
    const {
      category = 'geral',
      question,
      response,
      confidence,
      accepted,
      edited,
      responseTime,
      sentiment,
      conversion
    } = data;

    const entry = {
      id: `score_${Date.now()}`,
      category,
      question,
      response,
      confidence: confidence || 0.7,
      accepted: accepted ?? true,
      edited: edited ?? false,
      responseTime: responseTime || 0,
      sentiment: sentiment || 'neutral',
      conversion: conversion ?? false,
      timestamp: Date.now()
    };

    // Adicionar ao histórico
    this.history.push(entry);

    // Atualizar categoria
    this.updateCategoryScore(category, entry);

    return entry;
  }

  /**
   * Atualiza score de uma categoria
   */
  updateCategoryScore(category, entry) {
    if (!this.categories.has(category)) {
      this.categories.set(category, {
        category,
        totalInteractions: 0,
        accepted: 0,
        edited: 0,
        rejected: 0,
        conversions: 0,
        totalConfidence: 0,
        totalResponseTime: 0,
        sentimentCounts: { positive: 0, neutral: 0, negative: 0 },
        recentScores: [],
        trend: 'stable'
      });
    }

    const cat = this.categories.get(category);
    
    cat.totalInteractions++;
    cat.totalConfidence += entry.confidence;
    cat.totalResponseTime += entry.responseTime;

    if (entry.accepted) {
      cat.accepted++;
      if (entry.edited) cat.edited++;
    } else {
      cat.rejected++;
    }

    if (entry.conversion) cat.conversions++;
    if (entry.sentiment) {
      cat.sentimentCounts[entry.sentiment] = (cat.sentimentCounts[entry.sentiment] || 0) + 1;
    }

    // Manter últimos 50 scores para tendência
    const score = this.calculateEntryScore(entry);
    cat.recentScores.push(score);
    if (cat.recentScores.length > 50) {
      cat.recentScores.shift();
    }

    // Calcular tendência
    cat.trend = this.calculateTrend(cat.recentScores);
  }

  /**
   * Calcula score de uma entrada individual
   */
  calculateEntryScore(entry) {
    let score = 0;
    
    // Base: confiança (40%)
    score += entry.confidence * 0.4;
    
    // Aceitação (30%)
    if (entry.accepted) {
      score += entry.edited ? 0.2 : 0.3;
    }
    
    // Sentimento (15%)
    if (entry.sentiment === 'positive') score += 0.15;
    else if (entry.sentiment === 'neutral') score += 0.1;
    else if (entry.sentiment === 'negative') score += 0;
    
    // Conversão (15%)
    if (entry.conversion) score += 0.15;

    return Math.min(1, score);
  }

  // ============================================
  // ANÁLISE
  // ============================================

  /**
   * Obtém score de uma categoria
   */
  getCategoryScore(category) {
    const cat = this.categories.get(category);
    if (!cat || cat.totalInteractions === 0) {
      return { score: 0, level: 'unknown', metrics: null };
    }

    const metrics = {
      acceptanceRate: cat.accepted / cat.totalInteractions,
      editRate: cat.accepted > 0 ? cat.edited / cat.accepted : 0,
      rejectionRate: cat.rejected / cat.totalInteractions,
      avgConfidence: cat.totalConfidence / cat.totalInteractions,
      avgResponseTime: cat.totalResponseTime / cat.totalInteractions,
      conversionRate: cat.conversions / cat.totalInteractions,
      sentimentDistribution: {
        positive: cat.sentimentCounts.positive / cat.totalInteractions,
        neutral: cat.sentimentCounts.neutral / cat.totalInteractions,
        negative: cat.sentimentCounts.negative / cat.totalInteractions
      },
      totalInteractions: cat.totalInteractions,
      trend: cat.trend
    };

    // Calcular score composto
    const score = (
      metrics.acceptanceRate * 0.35 +
      metrics.avgConfidence * 0.25 +
      (1 - metrics.editRate) * 0.15 +
      metrics.conversionRate * 0.15 +
      metrics.sentimentDistribution.positive * 0.1
    );

    return {
      category,
      score: Math.round(score * 100) / 100,
      level: this.getLevel(score),
      metrics,
      trend: cat.trend
    };
  }

  /**
   * Obtém score de todas as categorias
   */
  getAllCategoryScores() {
    const scores = [];
    
    this.categories.forEach((_, category) => {
      scores.push(this.getCategoryScore(category));
    });

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Obtém score geral do sistema
   */
  getOverallScore() {
    if (this.history.length === 0) {
      return { score: 0, level: 'unknown' };
    }

    const recentHistory = this.history.slice(-200);
    
    const metrics = {
      totalInteractions: recentHistory.length,
      accepted: recentHistory.filter(e => e.accepted).length,
      edited: recentHistory.filter(e => e.edited).length,
      avgConfidence: recentHistory.reduce((sum, e) => sum + e.confidence, 0) / recentHistory.length,
      conversions: recentHistory.filter(e => e.conversion).length
    };

    const score = (
      (metrics.accepted / metrics.totalInteractions) * 0.4 +
      metrics.avgConfidence * 0.3 +
      ((metrics.accepted - metrics.edited) / metrics.totalInteractions) * 0.2 +
      (metrics.conversions / metrics.totalInteractions) * 0.1
    );

    return {
      score: Math.round(score * 100) / 100,
      level: this.getLevel(score),
      metrics
    };
  }

  /**
   * Obtém nível baseado no score
   */
  getLevel(score) {
    if (score >= this.thresholds.excellent) return 'excellent';
    if (score >= this.thresholds.good) return 'good';
    if (score >= this.thresholds.acceptable) return 'acceptable';
    if (score >= this.thresholds.poor) return 'poor';
    return 'critical';
  }

  /**
   * Calcula tendência dos últimos scores
   */
  calculateTrend(scores) {
    if (scores.length < 10) return 'insufficient_data';
    
    const recent = scores.slice(-10);
    const older = scores.slice(-20, -10);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    
    if (diff > 0.05) return 'improving';
    if (diff < -0.05) return 'declining';
    return 'stable';
  }

  // ============================================
  // ALERTAS E RECOMENDAÇÕES
  // ============================================

  /**
   * Gera alertas para categorias problemáticas
   */
  getAlerts() {
    const alerts = [];
    
    this.categories.forEach((cat, category) => {
      const score = this.getCategoryScore(category);
      
      // Alerta de baixo score
      if (score.score < 0.5) {
        alerts.push({
          type: 'low_score',
          severity: score.score < 0.3 ? 'critical' : 'warning',
          category,
          message: `Categoria "${category}" com score baixo: ${(score.score * 100).toFixed(0)}%`,
          suggestion: 'Adicione mais exemplos de treinamento para esta categoria'
        });
      }

      // Alerta de tendência negativa
      if (score.trend === 'declining') {
        alerts.push({
          type: 'declining_trend',
          severity: 'warning',
          category,
          message: `Categoria "${category}" em declínio`,
          suggestion: 'Revise os exemplos recentes e identifique padrões de erro'
        });
      }

      // Alerta de muitas edições
      if (score.metrics?.editRate > 0.3) {
        alerts.push({
          type: 'high_edit_rate',
          severity: 'info',
          category,
          message: `Alta taxa de edição em "${category}": ${(score.metrics.editRate * 100).toFixed(0)}%`,
          suggestion: 'Respostas estão sendo modificadas frequentemente'
        });
      }
    });

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Gera recomendações de melhoria
   */
  getRecommendations() {
    const recommendations = [];
    const scores = this.getAllCategoryScores();
    
    // Categorias para focar
    const lowScoreCategories = scores.filter(s => s.score < 0.6);
    if (lowScoreCategories.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'focus_categories',
        title: 'Focar em categorias problemáticas',
        description: `${lowScoreCategories.length} categoria(s) precisam de atenção`,
        categories: lowScoreCategories.map(c => c.category),
        action: 'Adicione exemplos de treinamento específicos'
      });
    }

    // Categorias sem dados
    const defaultCategories = ['vendas', 'suporte', 'duvidas', 'preco', 'disponibilidade'];
    const missingCategories = defaultCategories.filter(c => !this.categories.has(c));
    if (missingCategories.length > 0) {
      recommendations.push({
        priority: 'medium',
        type: 'missing_categories',
        title: 'Categorias sem dados',
        description: `Algumas categorias importantes não têm histórico`,
        categories: missingCategories,
        action: 'Configure exemplos para estas categorias'
      });
    }

    // Categorias com bom desempenho (para replicar)
    const highScoreCategories = scores.filter(s => s.score >= 0.8);
    if (highScoreCategories.length > 0) {
      recommendations.push({
        priority: 'info',
        type: 'success_pattern',
        title: 'Padrões de sucesso',
        description: `${highScoreCategories.length} categoria(s) com excelente performance`,
        categories: highScoreCategories.map(c => c.category),
        action: 'Use como referência para outras categorias'
      });
    }

    return recommendations;
  }

  // ============================================
  // HISTÓRICO E EXPORT
  // ============================================

  /**
   * Obtém histórico por período
   */
  getHistoryByPeriod(days = 7) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return this.history.filter(h => h.timestamp >= cutoff);
  }

  /**
   * Exporta dados para análise
   */
  export() {
    return {
      categories: Array.from(this.categories.entries()),
      history: this.history,
      overall: this.getOverallScore(),
      alerts: this.getAlerts(),
      recommendations: this.getRecommendations(),
      exportedAt: Date.now()
    };
  }

  /**
   * Limpa histórico antigo
   */
  cleanOldHistory(days = 30) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    this.history = this.history.filter(h => h.timestamp >= cutoff);
  }
}

// Exportar
window.QualityScorer = QualityScorer;
window.qualityScorer = new QualityScorer();
console.log('[QualityScorer] ✅ Módulo de qualidade por categoria carregado');
