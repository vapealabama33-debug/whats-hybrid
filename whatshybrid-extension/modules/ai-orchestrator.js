/**
 * AI Orchestrator Module - Coordinates all AI processing components
 * @module ai-orchestrator
 */

(function() {
  'use strict';

  // Initialize logger
  const logger = (typeof window !== 'undefined' && window.WHLogger) ? window.WHLogger.child('AIOrchestrator') : null;

  /**
   * Orchestrates all AI processing components
   */
  class AIOrchestrator {
    constructor(config = {}) {
      // Modules will be injected or loaded
      this.intentClassifier = null;
      this.conversationMemory = null;
      this.abTester = null;
      this.analytics = null;
      this.safetyFilter = null;
      this.hybridSearch = null;
      this.promptBuilder = null;
      
      this.config = {
        enableABTesting: true,
        enableAnalytics: true,
        enableSafety: true,
        confidenceThreshold: 0.7,
        ...config
      };

      if (logger) {
        logger.info('Initialized');
      }
    }

    /**
     * Initialize with required modules
     * @param {Object} modules - Module instances
     */
    initialize(modules) {
      this.intentClassifier = modules.intentClassifier;
      this.conversationMemory = modules.conversationMemory;
      this.abTester = modules.abTester;
      this.analytics = modules.analytics;
      this.safetyFilter = modules.safetyFilter;
      this.hybridSearch = modules.hybridSearch;
      this.promptBuilder = modules.promptBuilder;
      
      if (logger) {
        logger.info('Modules loaded');
      }
    }

    /**
     * Process incoming message through all AI modules
     * @param {string} chatId - Chat identifier
     * @param {string} message - User message
     * @param {Object} context - Additional context
     * @returns {Promise<Object>} Processing result with response
     */
    async processMessage(chatId, message, context = {}) {
      // Input validation
      if (!chatId || typeof chatId !== 'string') {
        throw new Error('chatId is required and must be a string');
      }
      if (!message || typeof message !== 'string') {
        throw new Error('message is required and must be a string');
      }
      
      if (!this.intentClassifier && !this.conversationMemory && !this.safetyFilter) {
        if (logger) {
          logger.warn('No modules initialized. Call initialize() first.');
        }
      }
      
      const startTime = Date.now();
      
      try {
        // Step 1: Load conversation context
        const conversationContext = this.conversationMemory 
          ? await this.conversationMemory.getContext(chatId)
          : { recentMessages: [] };
        
        // Step 2: Classify intent
        const intentResult = this.intentClassifier
          ? await this.intentClassifier.classify(message, {
              history: conversationContext.recentMessages || [],
              ...context
            })
          : { intent: 'general', confidence: 0.5 };

        // Step 3: Check confidence and track knowledge gaps
        if (intentResult.confidence < this.config.confidenceThreshold) {
          if (this.config.enableAnalytics && this.analytics) {
            this.analytics.recordKnowledgeGap({
              chatId,
              question: message,
              intent: intentResult.intent,
              confidence: intentResult.confidence,
              reason: 'low_confidence',
              context: { ...context, intentResult }
            });
          }
        }

        // Step 3b: Search knowledge base for relevant context
        let knowledgeResults = [];
        if (this.hybridSearch) {
          try {
            const searchResults = await this.hybridSearch.search(message, 5);
            knowledgeResults = searchResults || [];
          } catch (err) {
            if (logger) {
              logger.warn('HybridSearch error', { error: err.message });
            }
          }
        }

        // Step 3c: Build dynamic prompt
        let dynamicPrompt = null;
        if (this.promptBuilder) {
          try {
            dynamicPrompt = this.promptBuilder.build({
              intent: intentResult.intent,
              confidence: intentResult.confidence,
              memory: conversationContext,
              knowledge: knowledgeResults,
              emotionalContext: context.emotionalContext
            });
          } catch (err) {
            if (logger) {
              logger.warn('DynamicPromptBuilder error', { error: err.message });
            }
          }
        }

        // Step 4: Select response variant if A/B testing is enabled
        let responseVariant = 'default';
        if (this.config.enableABTesting && this.abTester && intentResult.intent) {
          const experimentId = `intent_${intentResult.intent}`;
          try {
            if (!this.abTester.experiments.has(experimentId)) {
              this.abTester.createExperiment(
                experimentId,
                ['default', 'variant_a', 'variant_b'],
                { minSamples: 50 }
              );
            }
            responseVariant = this.abTester.selectVariant(experimentId);
          } catch (err) {
            if (logger) {
              logger.warn('A/B testing error', { error: err.message });
            }
          }
        }

        // Step 5: Generate response
        let response = await this._generateResponse(
          message,
          intentResult,
          conversationContext,
          responseVariant,
          knowledgeResults,
          dynamicPrompt
        );

        // Step 6: Safety validation
        let safetyResult = null;
        if (this.config.enableSafety && this.safetyFilter) {
          safetyResult = this.safetyFilter.validate(response, {
            intent: intentResult.intent,
            emotionalContext: context.emotionalContext,
            knownEntities: context.knownEntities
          });

          if (!safetyResult.safe) {
            if (logger) {
              logger.warn('Unsafe response blocked', { chatId });
            }
            response = 'Desculpe, não posso processar essa solicitação no momento. Como posso ajudar de outra forma?';
          } else if (safetyResult.modifiedResponse !== response) {
            response = safetyResult.modifiedResponse;
          }
        }

        // Step 7: Update conversation memory
        if (this.conversationMemory) {
          await this.conversationMemory.addMessage(chatId, {
            role: 'user',
            content: message,
            timestamp: new Date()
          });

          await this.conversationMemory.addMessage(chatId, {
            role: 'assistant',
            content: response,
            timestamp: new Date(),
            metadata: {
              intent: intentResult.intent,
              confidence: intentResult.confidence,
              variant: responseVariant
            }
          });
        }

        // Step 8: Record analytics
        const latency = Date.now() - startTime;
        let interactionId = null;
        
        if (this.config.enableAnalytics && this.analytics) {
          interactionId = this.analytics.recordInteraction({
            chatId,
            message,
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            response,
            latency,
            tokenCount: this._estimateTokens(message + response),
            metadata: {
              variant: responseVariant,
              safetyChecked: !!safetyResult
            }
          });
        }

        // Step 9: Return complete result
        return {
          success: true,
          response,
          metadata: {
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            latency,
            variant: responseVariant,
            interactionId,
            safetyIssues: safetyResult?.issues || [],
            knowledgeResultsCount: knowledgeResults.length,
            dynamicPromptUsed: !!dynamicPrompt,
            timestamp: new Date()
          }
        };

      } catch (error) {
        if (logger) {
          logger.error('Error processing message', { error: error.message, chatId });
        }
        
        return {
          success: false,
          response: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
          error: error.message,
          metadata: {
            latency: Date.now() - startTime,
            timestamp: new Date()
          }
        };
      }
    }

    /**
     * Record feedback for an interaction
     * @param {string} interactionId - Interaction ID from analytics
     * @param {string} feedback - Feedback type
     */
    recordFeedback(interactionId, feedback) {
      if (this.config.enableAnalytics && this.analytics) {
        this.analytics.updateFeedback(interactionId, feedback);
      }
      if (logger) {
        logger.info('Recorded feedback', { interactionId, feedback });
      }
    }

    /**
     * Get analytics summary
     * @returns {Object} Analytics summary
     */
    getAnalyticsSummary() {
      if (!this.config.enableAnalytics || !this.analytics) {
        return { enabled: false };
      }
      return this.analytics.getMetricsSummary();
    }

    /**
     * Generate weekly report
     * @returns {Object} Weekly analytics report
     */
    generateWeeklyReport() {
      if (!this.config.enableAnalytics || !this.analytics) {
        return { enabled: false };
      }
      return this.analytics.generateWeeklyReport();
    }

    /**
     * Generate AI response (placeholder)
     * @private
     */
    async _generateResponse(message, intentResult, conversationContext, variant, knowledgeResults = [], dynamicPrompt = null) {
      const responses = {
        greeting: 'Olá! Como posso ajudar você hoje?',
        question: 'Essa é uma ótima pergunta. Vou ajudar você com isso.',
        support: 'Entendo sua situação. Vou fazer o possível para resolver isso.',
        feedback: 'Obrigado pelo seu feedback! Isso é muito útil para nós.',
        farewell: 'Foi um prazer ajudar! Até mais!'
      };

      let baseResponse = responses[intentResult.intent] || 'Como posso ajudar você?';

      // If knowledge results are available, append relevant context
      if (knowledgeResults.length > 0 && intentResult.intent !== 'greeting' && intentResult.intent !== 'farewell') {
        const topResult = knowledgeResults[0];
        if (topResult && topResult.content) {
          // Strip all HTML tags for security - knowledge base should contain plain text only
          // Note: This basic sanitization is sufficient for text-based content.
          // For richer content needs, consider using a proper HTML sanitization library.
          const sanitizedContent = String(topResult.content).replace(/<[^>]*>/g, '').trim();
          if (sanitizedContent) {
            baseResponse = sanitizedContent;
          }
        }
      }

      if (variant === 'variant_a') {
        baseResponse = '👋 ' + baseResponse;
      } else if (variant === 'variant_b') {
        baseResponse = baseResponse + ' 😊';
      }

      return baseResponse;
    }

    /**
     * Estimate token count for text
     * @private
     */
    _estimateTokens(text) {
      return Math.ceil(text.length / 4);
    }
  }

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIOrchestrator;
  } else {
    window.AIOrchestrator = AIOrchestrator;
  }
})();
