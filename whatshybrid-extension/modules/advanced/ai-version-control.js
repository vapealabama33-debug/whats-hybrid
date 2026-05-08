/**
 * ADV-009: AI Version Control - Controle de versão para configurações de IA
 * 
 * @version 1.0.0
 * @since 7.9.14
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'whl_ai_version_control',
    MAX_VERSIONS: 50,
    AUTO_SNAPSHOT_INTERVAL_MS: 3600000 // 1 hora
  };

  class AIVersionControl {
    constructor() {
      this.versions = [];
      this.currentVersion = null;
      this.autoSnapshotTimer = null;
      this.initialized = false;
    }

    async init() {
      await this._loadData();
      this._startAutoSnapshot();
      this.initialized = true;
      console.log('[AIVersionControl] Initialized');
    }

    async _loadData() {
      try {
        const data = await this._getStorage(CONFIG.STORAGE_KEY);
        if (data) {
          this.versions = data.versions || [];
          this.currentVersion = data.currentVersion;
        }
      } catch (e) {
        console.warn('[AIVersionControl] Load failed:', e);
      }
    }

    async _saveData() {
      await this._setStorage(CONFIG.STORAGE_KEY, {
        versions: this.versions.slice(-CONFIG.MAX_VERSIONS),
        currentVersion: this.currentVersion
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

    _startAutoSnapshot() {
      this.autoSnapshotTimer = setInterval(() => {
        this.createSnapshot('auto', 'Snapshot automático');
      }, CONFIG.AUTO_SNAPSHOT_INTERVAL_MS);
    }

    /**
     * Coleta configuração atual da IA
     */
    async _collectCurrentConfig() {
      const config = {
        personas: window.WHLMultiPersona?.exportData?.() || null,
        fewShot: window.WHLDynamicFewShot?.exportExamples?.() || null,
        confidence: window.WHLGranularConfidence?.exportData?.() || null,
        knowledgeBase: await this._getKnowledgeBaseSnapshot(),
        templates: window.WHLSmartTemplates?.exportData?.() || null,
        settings: await this._getGeneralSettings()
      };

      return config;
    }

    async _getKnowledgeBaseSnapshot() {
      return new Promise(r => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.get(['knowledgeBase'], res => {
            r(res.knowledgeBase ? { count: Object.keys(res.knowledgeBase).length } : null);
          });
        } else r(null);
      });
    }

    async _getGeneralSettings() {
      return new Promise(r => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.get(['aiSettings', 'modelConfig'], res => {
            r({ aiSettings: res.aiSettings, modelConfig: res.modelConfig });
          });
        } else r(null);
      });
    }

    /**
     * Cria snapshot da versão atual
     */
    async createSnapshot(type = 'manual', description = '') {
      const config = await this._collectCurrentConfig();

      const version = {
        id: `v_${Date.now()}`,
        version: `${this.versions.length + 1}.0.0`,
        type,
        description,
        config,
        createdAt: Date.now(),
        createdBy: type === 'auto' ? 'system' : 'user'
      };

      this.versions.push(version);
      this.currentVersion = version.id;
      await this._saveData();

      console.log('[AIVersionControl] Snapshot created:', version.version);
      return version;
    }

    /**
     * Restaura para uma versão anterior
     */
    async restore(versionId) {
      const version = this.versions.find(v => v.id === versionId);
      if (!version) throw new Error('Version not found');

      const { config } = version;

      // Criar backup antes de restaurar
      await this.createSnapshot('pre_restore', `Backup antes de restaurar para ${version.version}`);

      // Restaurar configurações
      if (config.settings?.aiSettings) {
        await this._setStorage('aiSettings', config.settings.aiSettings);
      }
      if (config.settings?.modelConfig) {
        await this._setStorage('modelConfig', config.settings.modelConfig);
      }

      this.currentVersion = versionId;
      await this._saveData();

      console.log('[AIVersionControl] Restored to:', version.version);
      return version;
    }

    /**
     * Compara duas versões
     */
    compare(versionId1, versionId2) {
      const v1 = this.versions.find(v => v.id === versionId1);
      const v2 = this.versions.find(v => v.id === versionId2);

      if (!v1 || !v2) throw new Error('Version not found');

      const diff = {
        versions: [v1.version, v2.version],
        changes: []
      };

      // Comparar componentes
      const components = ['personas', 'fewShot', 'confidence', 'templates'];
      for (const comp of components) {
        const c1 = JSON.stringify(v1.config[comp]);
        const c2 = JSON.stringify(v2.config[comp]);
        if (c1 !== c2) {
          diff.changes.push({
            component: comp,
            changed: true,
            v1Size: c1?.length || 0,
            v2Size: c2?.length || 0
          });
        }
      }

      return diff;
    }

    /**
     * Lista versões
     */
    listVersions(limit = 20) {
      return this.versions
        .slice(-limit)
        .reverse()
        .map(v => ({
          id: v.id,
          version: v.version,
          type: v.type,
          description: v.description,
          createdAt: new Date(v.createdAt).toLocaleString(),
          isCurrent: v.id === this.currentVersion
        }));
    }

    /**
     * Deleta versão
     */
    async deleteVersion(versionId) {
      if (versionId === this.currentVersion) {
        throw new Error('Cannot delete current version');
      }
      
      this.versions = this.versions.filter(v => v.id !== versionId);
      await this._saveData();
      return true;
    }

    /**
     * Exporta versão
     */
    exportVersion(versionId) {
      const version = this.versions.find(v => v.id === versionId);
      if (!version) throw new Error('Version not found');

      return {
        ...version,
        exportedAt: new Date().toISOString(),
        format: 'whl_ai_config_v1'
      };
    }

    /**
     * Importa versão
     */
    async importVersion(data) {
      if (data.format !== 'whl_ai_config_v1') {
        throw new Error('Invalid format');
      }

      const version = {
        ...data,
        id: `v_${Date.now()}_imported`,
        type: 'imported',
        createdAt: Date.now()
      };

      this.versions.push(version);
      await this._saveData();
      return version;
    }

    getStats() {
      return {
        totalVersions: this.versions.length,
        currentVersion: this.versions.find(v => v.id === this.currentVersion)?.version,
        oldestVersion: this.versions[0]?.createdAt 
          ? new Date(this.versions[0].createdAt).toLocaleDateString() 
          : 'N/A',
        autoSnapshots: this.versions.filter(v => v.type === 'auto').length
      };
    }

    destroy() {
      if (this.autoSnapshotTimer) clearInterval(this.autoSnapshotTimer);
    }
  }

  const versionControl = new AIVersionControl();
  versionControl.init();

  window.WHLAIVersionControl = versionControl;
  console.log('[ADV-009] AI Version Control initialized');

})();
