/**
 * 🧪 A/B Testing - Teste de Variações de Resposta
 * Permite testar múltiplas versões de resposta para encontrar a melhor
 * 
 * @version 1.0.0
 */

class ABTesting {
  constructor() {
    this.tests = new Map();
    this.results = new Map();
    this.activeTests = [];
  }

  // ============================================
  // CRIAÇÃO DE TESTES
  // ============================================

  /**
   * Cria um novo teste A/B
   * @param {Object} config - Configuração do teste
   */
  createTest(config) {
    const {
      name,
      question,
      variations,
      metrics = ['acceptance', 'engagement', 'conversion']
    } = config;

    if (!question || !variations || variations.length < 2) {
      throw new Error('Teste precisa de uma pergunta e pelo menos 2 variações');
    }

    const test = {
      id: `test_${Date.now()}`,
      name: name || `Teste ${this.tests.size + 1}`,
      question,
      variations: variations.map((v, idx) => ({
        id: `var_${idx}`,
        label: v.label || `Variação ${String.fromCharCode(65 + idx)}`,
        response: v.response,
        impressions: 0,
        accepted: 0,
        edited: 0,
        rejected: 0,
        engagementScore: 0,
        conversionCount: 0
      })),
      metrics,
      status: 'draft',
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
      winner: null
    };

    this.tests.set(test.id, test);
    return test;
  }

  /**
   * Inicia um teste
   */
  startTest(testId) {
    const test = this.tests.get(testId);
    if (!test) throw new Error('Teste não encontrado');

    test.status = 'running';
    test.startedAt = Date.now();
    this.activeTests.push(testId);

    return test;
  }

  /**
   * Para um teste
   */
  stopTest(testId) {
    const test = this.tests.get(testId);
    if (!test) throw new Error('Teste não encontrado');

    test.status = 'completed';
    test.endedAt = Date.now();
    this.activeTests = this.activeTests.filter(id => id !== testId);
    
    // Calcular vencedor
    test.winner = this.determineWinner(test);

    return test;
  }

  // ============================================
  // EXECUÇÃO DO TESTE
  // ============================================

  /**
   * Obtém uma variação para mostrar (distribuição uniforme)
   */
  getVariation(testId) {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') return null;

    // Distribuição uniforme - escolhe a com menos impressões
    const sorted = [...test.variations].sort((a, b) => a.impressions - b.impressions);
    const variation = sorted[0];
    
    variation.impressions++;
    
    return {
      testId,
      variationId: variation.id,
      label: variation.label,
      response: variation.response
    };
  }

  /**
   * Obtém variação aleatória para um teste ativo que corresponde à pergunta
   */
  getVariationForQuestion(question) {
    for (const testId of this.activeTests) {
      const test = this.tests.get(testId);
      if (this.questionMatches(question, test.question)) {
        return this.getVariation(testId);
      }
    }
    return null;
  }

  /**
   * Verifica se pergunta corresponde ao teste
   */
  questionMatches(input, testQuestion) {
    const normalizedInput = input.toLowerCase().trim();
    const normalizedTest = testQuestion.toLowerCase().trim();
    
    // Match exato ou similaridade alta
    if (normalizedInput === normalizedTest) return true;
    
    // Palavras-chave em comum
    const inputWords = new Set(normalizedInput.split(/\s+/));
    const testWords = new Set(normalizedTest.split(/\s+/));
    const intersection = [...inputWords].filter(w => testWords.has(w));
    
    return intersection.length >= Math.min(3, testWords.size * 0.5);
  }

  // ============================================
  // REGISTRO DE RESULTADOS
  // ============================================

  /**
   * Registra aceitação de variação
   */
  recordAcceptance(testId, variationId, accepted = true, edited = false) {
    const test = this.tests.get(testId);
    if (!test) return;

    const variation = test.variations.find(v => v.id === variationId);
    if (!variation) return;

    if (accepted) {
      variation.accepted++;
      if (edited) {
        variation.edited++;
      }
    } else {
      variation.rejected++;
    }

    this.updateEngagementScore(variation);
  }

  /**
   * Registra conversão (venda, cadastro, etc)
   */
  recordConversion(testId, variationId) {
    const test = this.tests.get(testId);
    if (!test) return;

    const variation = test.variations.find(v => v.id === variationId);
    if (variation) {
      variation.conversionCount++;
    }
  }

  /**
   * Atualiza score de engajamento
   */
  updateEngagementScore(variation) {
    if (variation.impressions === 0) {
      variation.engagementScore = 0;
      return;
    }

    // Score = (accepted - edited*0.5 - rejected) / impressions
    const score = (
      variation.accepted - 
      (variation.edited * 0.5) - 
      variation.rejected
    ) / variation.impressions;

    variation.engagementScore = Math.max(0, Math.min(1, (score + 1) / 2));
  }

  // ============================================
  // ANÁLISE DE RESULTADOS
  // ============================================

  /**
   * Obtém métricas de um teste
   */
  getTestMetrics(testId) {
    const test = this.tests.get(testId);
    if (!test) return null;

    return {
      testId,
      name: test.name,
      status: test.status,
      duration: test.endedAt ? test.endedAt - test.startedAt : Date.now() - test.startedAt,
      variations: test.variations.map(v => ({
        id: v.id,
        label: v.label,
        impressions: v.impressions,
        acceptanceRate: v.impressions > 0 ? v.accepted / v.impressions : 0,
        editRate: v.accepted > 0 ? v.edited / v.accepted : 0,
        rejectionRate: v.impressions > 0 ? v.rejected / v.impressions : 0,
        engagementScore: v.engagementScore,
        conversionRate: v.impressions > 0 ? v.conversionCount / v.impressions : 0
      })),
      winner: test.winner
    };
  }

  /**
   * Determina o vencedor do teste
   */
  determineWinner(test) {
    const validVariations = test.variations.filter(v => v.impressions >= 5);
    
    if (validVariations.length === 0) {
      return { determined: false, reason: 'Dados insuficientes' };
    }

    // Calcular score composto
    const scores = validVariations.map(v => {
      const acceptanceRate = v.accepted / v.impressions;
      const editPenalty = (v.edited / Math.max(1, v.accepted)) * 0.2;
      const conversionBonus = (v.conversionCount / v.impressions) * 0.3;
      
      return {
        variationId: v.id,
        label: v.label,
        score: acceptanceRate - editPenalty + conversionBonus,
        acceptanceRate,
        conversionRate: v.conversionCount / v.impressions
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winner = scores[0];
    const runnerUp = scores[1];

    // Verificar significância estatística simples (diferença > 10%)
    const isSignificant = runnerUp ? (winner.score - runnerUp.score) > 0.1 : true;

    return {
      determined: true,
      variationId: winner.variationId,
      label: winner.label,
      score: winner.score,
      acceptanceRate: winner.acceptanceRate,
      conversionRate: winner.conversionRate,
      isSignificant,
      confidence: isSignificant ? 'high' : 'medium'
    };
  }

  /**
   * Promove variação vencedora para produção
   */
  async promoteWinner(testId) {
    const test = this.tests.get(testId);
    if (!test || !test.winner?.determined) {
      return { success: false, reason: 'Teste sem vencedor determinado' };
    }

    const winnerVariation = test.variations.find(v => v.id === test.winner.variationId);
    
    // Salvar como exemplo de few-shot
    if (window.fewShotLearning) {
      await window.fewShotLearning.addExample({
        input: test.question,
        output: winnerVariation.response,
        category: 'ab_test_winner',
        quality: 9,
        tags: ['ab_test', 'winner', test.id],
        source: 'ab_testing',
        context: {
          testName: test.name,
          acceptanceRate: test.winner.acceptanceRate,
          conversionRate: test.winner.conversionRate
        }
      });

      return { 
        success: true, 
        message: `Variação "${winnerVariation.label}" promovida para treinamento`
      };
    }

    return { success: false, reason: 'Sistema de few-shot não disponível' };
  }

  // ============================================
  // GETTERS E UTILS
  // ============================================

  getTest(testId) {
    return this.tests.get(testId);
  }

  getAllTests() {
    return Array.from(this.tests.values());
  }

  getActiveTests() {
    return this.activeTests.map(id => this.tests.get(id));
  }

  deleteTest(testId) {
    this.activeTests = this.activeTests.filter(id => id !== testId);
    return this.tests.delete(testId);
  }
}

// Exportar
window.ABTesting = ABTesting;
window.abTesting = new ABTesting();
console.log('[ABTesting] ✅ Módulo de A/B Testing carregado');
