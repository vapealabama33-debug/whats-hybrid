/**
 * ADV-007: Explainable AI - IA explicável com transparência nas decisões
 * 
 * @version 1.0.0
 * @since 7.9.14
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'whl_explainable_ai',
    LOG_DECISIONS: true,
    MAX_DECISION_LOG: 1000
  };

  class ExplainableAI {
    constructor() {
      this.decisionLog = [];
      this.explanationTemplates = this._initTemplates();
      this.initialized = false;
    }

    _initTemplates() {
      return {
        confidence: {
          high: 'Alta confiança ({score}%) baseada em {factors}.',
          medium: 'Confiança moderada ({score}%) - {factors}.',
          low: 'Baixa confiança ({score}%). Recomenda-se revisão. Fatores: {factors}.'
        },
        source: {
          knowledge_base: 'Resposta baseada na base de conhecimento.',
          few_shot: 'Resposta inspirada em exemplos anteriores similares.',
          ai_generation: 'Resposta gerada pela IA sem exemplos diretos.',
          template: 'Resposta baseada em template pré-definido.'
        },
        factors: {
          keyword_match: 'correspondência de palavras-chave',
          semantic_similarity: 'similaridade semântica',
          historical_success: 'sucesso histórico com perguntas similares',
          context_match: 'contexto da conversa',
          persona_fit: 'adequação à persona ativa'
        }
      };
    }

    async init() {
      await this._loadData();
      this.initialized = true;
      console.log('[ExplainableAI] Initialized');
    }

    async _loadData() {
      try {
        const data = await this._getStorage(CONFIG.STORAGE_KEY);
        if (data) {
          this.decisionLog = data.decisionLog || [];
        }
      } catch (e) {
        console.warn('[ExplainableAI] Load failed:', e);
      }
    }

    async _saveData() {
      await this._setStorage(CONFIG.STORAGE_KEY, {
        decisionLog: this.decisionLog.slice(-CONFIG.MAX_DECISION_LOG)
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
     * Registra e explica uma decisão da IA
     */
    explain(decision) {
      const {
        query,
        response,
        confidence,
        source,
        factors = [],
        alternatives = [],
        metadata = {}
      } = decision;

      // Gerar explicação
      const explanation = this._generateExplanation(decision);

      const record = {
        id: `dec_${Date.now()}`,
        timestamp: Date.now(),
        query,
        response: response?.substring(0, 200),
        confidence,
        source,
        factors,
        alternatives: alternatives.slice(0, 3),
        explanation,
        metadata
      };

      if (CONFIG.LOG_DECISIONS) {
        this.decisionLog.push(record);
        this._saveData();
      }

      return {
        decision: record,
        humanReadable: explanation.humanReadable,
        technical: explanation.technical,
        recommendations: explanation.recommendations
      };
    }

    _generateExplanation(decision) {
      const { confidence, source, factors } = decision;

      // Classificar confiança
      let confidenceLevel = 'low';
      if (confidence >= 0.85) confidenceLevel = 'high';
      else if (confidence >= 0.65) confidenceLevel = 'medium';

      // Traduzir fatores
      const translatedFactors = factors
        .map(f => this.explanationTemplates.factors[f] || f)
        .join(', ');

      // Gerar explicação de confiança
      const confidenceExplanation = this.explanationTemplates.confidence[confidenceLevel]
        .replace('{score}', Math.round(confidence * 100))
        .replace('{factors}', translatedFactors || 'análise geral');

      // Gerar explicação da fonte
      const sourceExplanation = this.explanationTemplates.source[source] || 
        'Fonte não especificada.';

      // Recomendações
      const recommendations = [];
      if (confidence < 0.65) {
        recommendations.push('Considere revisar a resposta antes de enviar.');
      }
      if (factors.length === 0) {
        recommendations.push('Adicione mais exemplos à base de conhecimento.');
      }
      if (source === 'ai_generation') {
        recommendations.push('Valide informações factuais nesta resposta.');
      }

      return {
        humanReadable: `${confidenceExplanation} ${sourceExplanation}`,
        technical: {
          confidenceScore: confidence,
          confidenceLevel,
          source,
          factors,
          factorWeights: this._calculateFactorWeights(factors)
        },
        recommendations
      };
    }

    _calculateFactorWeights(factors) {
      const weights = {
        keyword_match: 0.25,
        semantic_similarity: 0.30,
        historical_success: 0.20,
        context_match: 0.15,
        persona_fit: 0.10
      };

      const result = {};
      let total = 0;

      for (const factor of factors) {
        if (weights[factor]) {
          result[factor] = weights[factor];
          total += weights[factor];
        }
      }

      // Normalizar
      if (total > 0) {
        for (const factor of Object.keys(result)) {
          result[factor] = result[factor] / total;
        }
      }

      return result;
    }

    /**
     * Gera explicação para o usuário final (simplificada)
     */
    getSimpleExplanation(decisionId) {
      const decision = this.decisionLog.find(d => d.id === decisionId);
      if (!decision) return null;

      const { confidence, source } = decision;
      
      let icon, message;
      
      if (confidence >= 0.85) {
        icon = '✅';
        message = 'Resposta altamente confiável';
      } else if (confidence >= 0.65) {
        icon = '⚡';
        message = 'Resposta com boa confiança';
      } else {
        icon = '⚠️';
        message = 'Resposta pode precisar de ajustes';
      }

      return {
        icon,
        message,
        source: this.explanationTemplates.source[source] || 'Fonte não identificada',
        confidence: Math.round(confidence * 100) + '%'
      };
    }

    /**
     * Obtém histórico de decisões
     */
    getDecisionHistory(limit = 50, filters = {}) {
      let decisions = [...this.decisionLog];

      if (filters.minConfidence) {
        decisions = decisions.filter(d => d.confidence >= filters.minConfidence);
      }
      if (filters.source) {
        decisions = decisions.filter(d => d.source === filters.source);
      }
      if (filters.since) {
        decisions = decisions.filter(d => d.timestamp >= filters.since);
      }

      return decisions.slice(-limit).reverse();
    }

    /**
     * Analisa padrões nas decisões
     */
    analyzePatterns() {
      if (this.decisionLog.length < 10) {
        return { message: 'Dados insuficientes para análise' };
      }

      const recent = this.decisionLog.slice(-100);

      // Confiança média
      const avgConfidence = recent.reduce((s, d) => s + d.confidence, 0) / recent.length;

      // Distribuição de fontes
      const sourceDistribution = {};
      for (const d of recent) {
        sourceDistribution[d.source] = (sourceDistribution[d.source] || 0) + 1;
      }

      // Fatores mais comuns
      const factorCounts = {};
      for (const d of recent) {
        for (const f of d.factors) {
          factorCounts[f] = (factorCounts[f] || 0) + 1;
        }
      }

      return {
        avgConfidence: (avgConfidence * 100).toFixed(1) + '%',
        sourceDistribution,
        topFactors: Object.entries(factorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
        lowConfidenceCount: recent.filter(d => d.confidence < 0.65).length,
        recommendations: this._generateGlobalRecommendations(avgConfidence, sourceDistribution)
      };
    }

    _generateGlobalRecommendations(avgConfidence, sourceDistribution) {
      const recs = [];

      if (avgConfidence < 0.7) {
        recs.push('Considere expandir a base de conhecimento para melhorar a confiança.');
      }
      
      if (sourceDistribution.ai_generation > (sourceDistribution.knowledge_base || 0)) {
        recs.push('Muitas respostas são geradas sem base de conhecimento. Adicione mais exemplos.');
      }

      return recs;
    }

    getStats() {
      return {
        totalDecisions: this.decisionLog.length,
        patterns: this.analyzePatterns()
      };
    }
  }

  const explainableAI = new ExplainableAI();
  explainableAI.init();

  window.WHLExplainableAI = explainableAI;
  console.log('[ADV-007] Explainable AI initialized');

})();
