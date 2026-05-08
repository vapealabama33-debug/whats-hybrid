/**
 * ADV-002: RLHF System - Reinforcement Learning from Human Feedback
 * 
 * @version 1.0.0
 * @since 7.9.14
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'whl_rlhf',
    COMPARISON_THRESHOLD: 10,
    REWARD_MODEL_UPDATE_INTERVAL: 100
  };

  class RLHFSystem {
    constructor() {
      this.comparisons = [];
      this.rewardModel = { weights: {}, bias: 0 };
      this.stats = { totalComparisons: 0, modelUpdates: 0 };
      this.initialized = false;
    }

    async init() {
      await this._loadData();
      this.initialized = true;
      console.log('[RLHF] Initialized');
    }

    async _loadData() {
      try {
        const data = await this._getStorage(CONFIG.STORAGE_KEY);
        if (data) {
          this.comparisons = data.comparisons || [];
          this.rewardModel = data.rewardModel || this.rewardModel;
          this.stats = data.stats || this.stats;
        }
      } catch (e) {
        console.warn('[RLHF] Load failed:', e);
      }
    }

    async _saveData() {
      await this._setStorage(CONFIG.STORAGE_KEY, {
        comparisons: this.comparisons.slice(-1000),
        rewardModel: this.rewardModel,
        stats: this.stats
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
     * Registra comparação de preferência
     */
    async recordComparison(question, responseA, responseB, preferred) {
      const comparison = {
        id: `comp_${Date.now()}`,
        question,
        responseA,
        responseB,
        preferred, // 'A' ou 'B'
        timestamp: Date.now()
      };

      this.comparisons.push(comparison);
      this.stats.totalComparisons++;

      // Atualizar modelo se atingir threshold
      if (this.stats.totalComparisons % CONFIG.REWARD_MODEL_UPDATE_INTERVAL === 0) {
        await this._updateRewardModel();
      }

      await this._saveData();
      return comparison.id;
    }

    /**
     * Calcula reward score para uma resposta
     */
    calculateReward(response, question) {
      const features = this._extractFeatures(response, question);
      let score = this.rewardModel.bias;

      for (const [feature, value] of Object.entries(features)) {
        score += (this.rewardModel.weights[feature] || 0) * value;
      }

      return Math.max(0, Math.min(1, score));
    }

    _extractFeatures(response, question) {
      const respLower = response.toLowerCase();
      const qLower = question.toLowerCase();
      const qWords = new Set(qLower.split(/\s+/).filter(w => w.length > 3));
      const rWords = new Set(respLower.split(/\s+/).filter(w => w.length > 3));

      // Calcular overlap
      const overlap = [...qWords].filter(w => rWords.has(w)).length / (qWords.size || 1);

      return {
        length: Math.min(1, response.length / 500),
        questionOverlap: overlap,
        hasGreeting: /^(olá|oi|bom dia|boa tarde|boa noite)/i.test(response) ? 1 : 0,
        hasEmoji: /[\u{1F300}-\u{1F9FF}]/u.test(response) ? 0.5 : 0,
        isPolite: /(obrigado|por favor|desculpe)/i.test(response) ? 1 : 0,
        hasQuestion: response.includes('?') ? 0.5 : 0,
        sentenceCount: (response.match(/[.!?]+/g) || []).length / 5
      };
    }

    async _updateRewardModel() {
      const recentComparisons = this.comparisons.slice(-500);
      if (recentComparisons.length < CONFIG.COMPARISON_THRESHOLD) return;

      const newWeights = { ...this.rewardModel.weights };
      const learningRate = 0.1;

      for (const comp of recentComparisons) {
        const featuresA = this._extractFeatures(comp.responseA, comp.question);
        const featuresB = this._extractFeatures(comp.responseB, comp.question);

        const preferredFeatures = comp.preferred === 'A' ? featuresA : featuresB;
        const rejectedFeatures = comp.preferred === 'A' ? featuresB : featuresA;

        for (const feature of Object.keys(preferredFeatures)) {
          const diff = preferredFeatures[feature] - rejectedFeatures[feature];
          newWeights[feature] = (newWeights[feature] || 0) + learningRate * diff;
        }
      }

      this.rewardModel.weights = newWeights;
      this.stats.modelUpdates++;
      await this._saveData();

      console.log('[RLHF] Reward model updated');
    }

    /**
     * Ranqueia múltiplas respostas
     */
    rankResponses(responses, question) {
      return responses
        .map((r, i) => ({
          index: i,
          response: r,
          reward: this.calculateReward(r, question)
        }))
        .sort((a, b) => b.reward - a.reward);
    }

    getStats() {
      return {
        ...this.stats,
        modelWeights: Object.keys(this.rewardModel.weights).length,
        comparisonsStored: this.comparisons.length
      };
    }

    exportData() {
      return {
        comparisons: this.comparisons,
        rewardModel: this.rewardModel,
        stats: this.getStats(),
        exportedAt: new Date().toISOString()
      };
    }
  }

  const rlhf = new RLHFSystem();
  rlhf.init();

  window.WHLRLHF = rlhf;
  console.log('[ADV-002] RLHF System initialized');

})();
