/**
 * 🔗 SmartBot Integration - Integração com SmartReplies
 * 
 * Conecta o SmartBot IA ao sistema de respostas inteligentes existente.
 * Adiciona análise avançada de contexto, priorização e aprendizado.
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ============================================================
  // 🛡️ SECURITY HELPERS
  // ============================================================

  /**
   * Escapes HTML special characters to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} - HTML-safe text
   */
  function escapeHtml(text) {
    if (!text || typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Aguarda SmartBot IA e SmartReplies estarem disponíveis
  let initAttempts = 0;
  const maxAttempts = 50;

  function waitForDependencies() {
    initAttempts++;
    
    if (window.smartBot && window.SmartRepliesModule) {
      initializeIntegration();
    } else if (initAttempts < maxAttempts) {
      setTimeout(waitForDependencies, 100);
    } else {
      console.error('[SmartBot Integration] Dependências não encontradas após', maxAttempts, 'tentativas');
    }
  }

  function initializeIntegration() {
    console.log('[SmartBot Integration] Inicializando integração...');

    const smartBot = window.smartBot;
    const smartReplies = window.SmartRepliesModule;

    // ============================================================
    // ENHANCED ANALYSIS
    // Adiciona análise avançada ao SmartReplies
    // ============================================================

    /**
     * Analisa contexto antes de gerar sugestões
     */
    async function enhancedAnalyze(chatId, messages, currentMessage) {
      // Análise do SmartBot
      const analysis = await smartBot.analyzeMessage(chatId, currentMessage, messages);
      
      // Combina com análise existente se disponível
      const existingAnalysis = smartReplies.state?.lastAnalysis || {};
      
      return {
        ...existingAnalysis,
        smartBot: analysis,
        enhanced: true
      };
    }

    // ============================================================
    // SUGGESTION ENHANCEMENT
    // Melhora sugestões com dados aprendidos
    // ============================================================

    /**
     * Enriquece sugestões com dados do SmartBot
     */
    function enhanceSuggestions(suggestions, analysis) {
      if (!analysis?.smartBot?.suggestions) return suggestions;

      const learnedSuggestions = analysis.smartBot.suggestions;
      const enhancedSuggestions = [...suggestions];

      // Adiciona sugestões aprendidas com alta confiança
      learnedSuggestions.forEach(learned => {
        if (learned.confidence > 0.6) {
          // Verifica se não é duplicada
          const isDuplicate = enhancedSuggestions.some(s => 
            calculateSimilarity(s.text || s, learned.text) > 0.7
          );
          
          if (!isDuplicate) {
            enhancedSuggestions.push({
              text: learned.text,
              source: 'learned',
              confidence: learned.confidence,
              icon: '🎓'
            });
          }
        }
      });

      // Reordena por relevância considerando contexto
      if (analysis.smartBot.context) {
        const context = analysis.smartBot.context;
        
        enhancedSuggestions.sort((a, b) => {
          let scoreA = a.confidence || 0.5;
          let scoreB = b.confidence || 0.5;
          
          // Boost para sugestões que combinam com o tom recomendado
          if (context.recommendedTone === 'empathetic_formal') {
            if (containsEmpathy(a.text || a)) scoreA += 0.2;
            if (containsEmpathy(b.text || b)) scoreB += 0.2;
          }
          
          // Boost para sugestões aprendidas
          if (a.source === 'learned') scoreA += 0.1;
          if (b.source === 'learned') scoreB += 0.1;
          
          return scoreB - scoreA;
        });
      }

      return enhancedSuggestions.slice(0, 5);
    }

    /**
     * Calcula similaridade entre textos
     */
    function calculateSimilarity(text1, text2) {
      if (!text1 || !text2) return 0;
      
      const words1 = new Set(text1.toLowerCase().split(/\s+/));
      const words2 = new Set(text2.toLowerCase().split(/\s+/));
      
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      
      return intersection.size / union.size;
    }

    /**
     * Verifica se texto contém empatia
     */
    function containsEmpathy(text) {
      if (!text) return false;
      const empathyWords = ['entendo', 'compreendo', 'lamento', 'sinto muito', 'desculpe', 'podemos ajudar'];
      return empathyWords.some(word => text.toLowerCase().includes(word));
    }

    // ============================================================
    // FEEDBACK INTEGRATION
    // Coleta feedback para aprendizado
    // ============================================================

    /**
     * Registra quando sugestão é usada
     */
    function trackSuggestionUsage(suggestion, input, context) {
      // Considera uso como feedback positivo (rating 4)
      smartBot.recordResponseFeedback(input, suggestion, 4, context);
      
      console.log('[SmartBot Integration] Sugestão usada registrada para aprendizado');
    }

    /**
     * Registra feedback explícito
     */
    function recordFeedback(input, response, rating, context = {}) {
      return smartBot.recordResponseFeedback(input, response, rating, context);
    }

    // ============================================================
    // CONTEXT DISPLAY
    // Exibe informações de contexto na UI
    // ============================================================

    /**
     * Cria painel de contexto para o sidepanel
     */
    function createContextPanel(analysis) {
      if (!analysis?.smartBot?.context) return null;

      const context = analysis.smartBot.context;
      const profile = context.customerProfile;
      const summary = context.contextSummary;

      const panel = document.createElement('div');
      panel.className = 'smartbot-context-panel';
      panel.innerHTML = `
        <div class="smartbot-context-header">
          <span class="smartbot-icon">🧠</span>
          <span>Análise SmartBot</span>
        </div>
        <div class="smartbot-context-body">
          <div class="smartbot-context-item">
            <span class="label">Cliente:</span>
            <span class="value">${summary.customerType === 'returning' ? '🔄 Retornando' : '✨ Novo'}</span>
          </div>
          <div class="smartbot-context-item">
            <span class="label">Humor:</span>
            <span class="value mood-${summary.currentMood}">
              ${summary.currentMood === 'positive' ? '😊' : summary.currentMood === 'negative' ? '😟' : '😐'}
              ${summary.currentMood}
            </span>
          </div>
          <div class="smartbot-context-item">
            <span class="label">Estágio:</span>
            <span class="value">${escapeHtml(context.flowAnalysis.currentStage)}</span>
          </div>
          <div class="smartbot-context-item">
            <span class="label">Urgência:</span>
            <div class="urgency-bar">
              <div class="urgency-fill" style="width: ${context.urgencyLevel * 100}%"></div>
            </div>
          </div>
          <div class="smartbot-context-item">
            <span class="label">Tom recomendado:</span>
            <span class="value tone-badge">${formatTone(context.recommendedTone)}</span>
          </div>
          ${context.suggestedApproach ? `
          <div class="smartbot-approach">
            <span class="label">Abordagem:</span>
            <span class="value">${formatApproach(context.suggestedApproach.approach)}</span>
          </div>
          ` : ''}
        </div>
      `;

      return panel;
    }

    /**
     * Formata tom para exibição
     */
    function formatTone(tone) {
      const tones = {
        'empathetic_formal': '💙 Empático Formal',
        'friendly_casual': '😊 Amigável',
        'familiar_professional': '🤝 Profissional Familiar',
        'professional_neutral': '💼 Profissional'
      };
      // SECURITY FIX (PARTIAL-013-P0.3): Escape fallback to prevent XSS
      return tones[tone] || escapeHtml(String(tone));
    }

    /**
     * Formata abordagem para exibição
     */
    function formatApproach(approach) {
      const approaches = {
        'immediate_action': '⚡ Ação Imediata',
        'empathetic_resolution': '💙 Resolução Empática',
        'consultative_selling': '💼 Venda Consultiva',
        'standard_support': '🛠️ Suporte Padrão'
      };
      // SECURITY FIX (PARTIAL-013-P0.3): Escape fallback to prevent XSS
      return approaches[approach] || escapeHtml(String(approach));
    }

    // ============================================================
    // METRICS DISPLAY
    // Exibe métricas no sidepanel
    // ============================================================

    /**
     * Cria painel de métricas
     */
    function createMetricsPanel() {
      const metrics = smartBot.getMetrics();
      
      const panel = document.createElement('div');
      panel.className = 'smartbot-metrics-panel';
      panel.innerHTML = `
        <div class="smartbot-metrics-header">
          <span class="smartbot-icon">📊</span>
          <span>Métricas SmartBot</span>
        </div>
        <div class="smartbot-metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${metrics.messages.today}</div>
            <div class="metric-label">Msgs Hoje</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${(metrics.computed.aiResponseRate * 100).toFixed(0)}%</div>
            <div class="metric-label">Respostas IA</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${(metrics.computed.positiveRate * 100).toFixed(0)}%</div>
            <div class="metric-label">Sentimento +</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${metrics.computed.avgResponseTimeSeconds.toFixed(1)}s</div>
            <div class="metric-label">Tempo Médio</div>
          </div>
        </div>
        ${metrics.anomalies.length > 0 ? `
        <div class="smartbot-anomalies">
          <div class="anomaly-header">⚠️ Anomalias Detectadas</div>
          ${metrics.anomalies.map(a => `
            <div class="anomaly-item">${escapeHtml(a.message)}</div>
          `).join('')}
        </div>
        ` : ''}
      `;

      return panel;
    }

    // ============================================================
    // CSS STYLES
    // Estilos para os componentes
    // ============================================================

    const styles = `
      .smartbot-context-panel,
      .smartbot-metrics-panel {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 12px;
        padding: 16px;
        margin: 12px 0;
        border: 1px solid rgba(99, 102, 241, 0.3);
      }

      .smartbot-context-header,
      .smartbot-metrics-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: #e0e7ff;
        margin-bottom: 12px;
        font-size: 14px;
      }

      .smartbot-icon {
        font-size: 18px;
      }

      .smartbot-context-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .smartbot-context-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
      }

      .smartbot-context-item .label {
        color: #9ca3af;
      }

      .smartbot-context-item .value {
        color: #e5e7eb;
        font-weight: 500;
      }

      .mood-positive { color: #4ade80 !important; }
      .mood-negative { color: #f87171 !important; }
      .mood-neutral { color: #fbbf24 !important; }

      .urgency-bar {
        width: 100px;
        height: 6px;
        background: #374151;
        border-radius: 3px;
        overflow: hidden;
      }

      .urgency-fill {
        height: 100%;
        background: linear-gradient(90deg, #4ade80 0%, #fbbf24 50%, #f87171 100%);
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      .tone-badge {
        background: rgba(99, 102, 241, 0.2);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
      }

      .smartbot-approach {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .smartbot-metrics-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .metric-card {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 12px;
        text-align: center;
      }

      .metric-value {
        font-size: 24px;
        font-weight: 700;
        color: #818cf8;
      }

      .metric-label {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 4px;
      }

      .smartbot-anomalies {
        margin-top: 12px;
        padding: 12px;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 8px;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .anomaly-header {
        font-weight: 600;
        color: #fca5a5;
        margin-bottom: 8px;
        font-size: 13px;
      }

      .anomaly-item {
        font-size: 12px;
        color: #fca5a5;
        padding: 4px 0;
      }

      /* Suggestion badges */
      .suggestion-item[data-source="learned"]::before {
        content: '🎓';
        margin-right: 6px;
      }

      .suggestion-confidence {
        font-size: 10px;
        color: #6b7280;
        margin-left: auto;
      }
    `;

    // Injeta estilos
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);

    // ============================================================
    // PUBLIC API
    // Expõe funções para uso externo
    // ============================================================

    window.SmartBotIntegration = {
      // Análise
      analyze: enhancedAnalyze,
      enhanceSuggestions,
      
      // Feedback
      trackUsage: trackSuggestionUsage,
      recordFeedback,
      
      // UI
      createContextPanel,
      createMetricsPanel,
      
      // Direct access
      getSmartBot: () => smartBot,
      getMetrics: () => smartBot.getMetrics(),
      getLearningStats: () => smartBot.getLearningStats(),
      getCustomerProfile: (chatId) => smartBot.getCustomerProfile(chatId),
      
      // Utilities
      calculateSimilarity,
      formatTone,
      formatApproach
    };

    // ============================================================
    // EVENT LISTENERS
    // Escuta eventos do sistema
    // ============================================================

    // Escuta anomalias
    window.addEventListener('smartbot:anomalies', (event) => {
      console.warn('[SmartBot Integration] Anomalias detectadas:', event.detail.anomalies);
      
      // Pode integrar com sistema de notificações
      if (window.NotificationsModule) {
        event.detail.anomalies.forEach(anomaly => {
          window.NotificationsModule.warning(`⚠️ ${anomaly.message}`);
        });
      }
    });

    console.log('[SmartBot Integration] ✅ Integração inicializada com sucesso');
  }

  // Inicia verificação de dependências
  waitForDependencies();

})();
