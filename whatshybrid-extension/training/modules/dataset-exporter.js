/**
 * 💾 Dataset Exporter - Exportação para Fine-Tuning
 * Gera datasets formatados para treinar modelos customizados
 * 
 * @version 1.0.0
 */

class DatasetExporter {
  constructor() {
    this.formats = ['jsonl', 'alpaca', 'sharegpt', 'csv', 'openai'];
    this.lastExport = null;
  }

  // ============================================
  // COLETA DE DADOS
  // ============================================

  /**
   * Coleta dados de todas as fontes
   */
  async collectData(options = {}) {
    const {
      includeExamples = true,
      includeFaqs = true,
      includeApproved = true,
      includeHighQuality = true,
      minQuality = 7,
      categories = []
    } = options;

    const data = [];

    // Few-shot examples
    if (includeExamples) {
      try {
        const stored = await chrome.storage.local.get('whl_few_shot_examples');
        const examples = stored.whl_few_shot_examples || [];
        
        examples.forEach(ex => {
          if (categories.length > 0 && !categories.includes(ex.category)) return;
          if (includeHighQuality && (ex.quality || 8) < minQuality) return;

          data.push({
            type: 'example',
            input: ex.input || ex.user || '',
            output: ex.output || ex.response || '',
            category: ex.category || 'geral',
            quality: ex.quality || 8,
            source: 'few_shot'
          });
        });
      } catch (e) {
        console.warn('[DatasetExporter] Erro ao coletar examples:', e);
      }
    }

    // FAQs da knowledge base
    if (includeFaqs) {
      try {
        const stored = await chrome.storage.local.get('whl_knowledge_base');
        const kb = stored.whl_knowledge_base || {};
        const faqs = kb.faqs || [];

        faqs.forEach(faq => {
          data.push({
            type: 'faq',
            input: faq.q || faq.question || '',
            output: faq.a || faq.answer || '',
            category: 'faq',
            quality: 9,
            source: 'knowledge_base'
          });
        });
      } catch (e) {
        console.warn('[DatasetExporter] Erro ao coletar FAQs:', e);
      }
    }

    // Simulações aprovadas
    if (includeApproved && window.simulationEngine) {
      const state = window.simulationEngine.getState();
      const approved = state.approvedResponses || [];

      approved.forEach(response => {
        const context = window.simulationEngine.getMessageContext(response.id);
        if (context) {
          data.push({
            type: 'simulation',
            input: context.content,
            output: response.content,
            category: state.theme || 'simulation',
            quality: 9,
            source: 'simulation_approved'
          });
        }
      });
    }

    return data;
  }

  // ============================================
  // FORMATOS DE EXPORTAÇÃO
  // ============================================

  /**
   * Exporta no formato JSONL (OpenAI fine-tuning)
   */
  toJSONL(data, options = {}) {
    const {
      systemPrompt = 'Você é um assistente prestativo de atendimento ao cliente.'
    } = options;

    const lines = data.map(item => {
      const entry = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: item.input },
          { role: 'assistant', content: item.output }
        ]
      };
      return JSON.stringify(entry);
    });

    return lines.join('\n');
  }

  /**
   * Exporta no formato Alpaca
   */
  toAlpaca(data, options = {}) {
    const {
      instruction = 'Responda a pergunta do cliente de forma profissional e prestativa.'
    } = options;

    const items = data.map(item => ({
      instruction: instruction,
      input: item.input,
      output: item.output
    }));

    return JSON.stringify(items, null, 2);
  }

  /**
   * Exporta no formato ShareGPT
   */
  toShareGPT(data, options = {}) {
    const conversations = [];
    
    // Agrupar por categoria se possível
    const grouped = new Map();
    data.forEach(item => {
      const key = item.category || 'default';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(item);
    });

    grouped.forEach((items, category) => {
      const conversation = {
        id: `conv_${category}_${Date.now()}`,
        conversations: items.map(item => ([
          { from: 'human', value: item.input },
          { from: 'gpt', value: item.output }
        ])).flat()
      };
      conversations.push(conversation);
    });

    return JSON.stringify(conversations, null, 2);
  }

  /**
   * Exporta no formato CSV
   */
  toCSV(data, options = {}) {
    const {
      delimiter = ',',
      includeMetadata = false
    } = options;

    const headers = includeMetadata 
      ? ['input', 'output', 'category', 'quality', 'source']
      : ['input', 'output'];

    const rows = [headers.join(delimiter)];

    data.forEach(item => {
      const values = includeMetadata
        ? [item.input, item.output, item.category, item.quality, item.source]
        : [item.input, item.output];
      
      // Escapar valores para CSV
      const escaped = values.map(v => {
        const str = String(v || '');
        if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });

      rows.push(escaped.join(delimiter));
    });

    return rows.join('\n');
  }

  /**
   * Exporta no formato OpenAI Chat Completion (para validação)
   */
  toOpenAIChatFormat(data, options = {}) {
    const {
      systemPrompt = 'Você é um assistente prestativo.'
    } = options;

    return data.map(item => ({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: item.input },
        { role: 'assistant', content: item.output }
      ],
      metadata: {
        category: item.category,
        quality: item.quality,
        source: item.source
      }
    }));
  }

  // ============================================
  // VALIDAÇÃO
  // ============================================

  /**
   * Valida dataset antes da exportação
   */
  validate(data) {
    const issues = [];
    const stats = {
      total: data.length,
      valid: 0,
      empty: 0,
      tooShort: 0,
      tooLong: 0,
      duplicates: 0
    };

    const seen = new Set();

    data.forEach((item, index) => {
      const input = item.input || '';
      const output = item.output || '';

      // Verificar vazios
      if (!input.trim() || !output.trim()) {
        issues.push({ index, type: 'empty', message: 'Input ou output vazio' });
        stats.empty++;
        return;
      }

      // Verificar tamanho mínimo
      if (input.length < 10 || output.length < 20) {
        issues.push({ index, type: 'too_short', message: 'Texto muito curto' });
        stats.tooShort++;
        return;
      }

      // Verificar tamanho máximo (4096 tokens ~ 16000 chars)
      if (input.length + output.length > 16000) {
        issues.push({ index, type: 'too_long', message: 'Texto muito longo' });
        stats.tooLong++;
        return;
      }

      // Verificar duplicatas
      const hash = `${input.toLowerCase().trim()}|${output.toLowerCase().trim()}`;
      if (seen.has(hash)) {
        issues.push({ index, type: 'duplicate', message: 'Entrada duplicada' });
        stats.duplicates++;
        return;
      }
      seen.add(hash);

      stats.valid++;
    });

    return {
      isValid: stats.valid === stats.total,
      stats,
      issues: issues.slice(0, 100) // Limitar issues exibidas
    };
  }

  // ============================================
  // EXPORTAÇÃO PRINCIPAL
  // ============================================

  /**
   * Exporta dataset completo
   */
  async export(format, options = {}) {
    // Coletar dados
    const data = await this.collectData(options);

    if (data.length === 0) {
      return { 
        success: false, 
        error: 'Nenhum dado para exportar',
        count: 0 
      };
    }

    // Validar
    const validation = this.validate(data);
    if (!validation.isValid && options.strictValidation) {
      return {
        success: false,
        error: 'Dataset inválido',
        validation
      };
    }

    // Filtrar apenas válidos se não for strict
    const validData = data.filter((_, idx) => 
      !validation.issues.some(i => i.index === idx)
    );

    // Converter para formato
    let content;
    let extension;
    let mimeType;

    switch (format) {
      case 'jsonl':
        content = this.toJSONL(validData, options);
        extension = 'jsonl';
        mimeType = 'application/jsonl';
        break;

      case 'alpaca':
        content = this.toAlpaca(validData, options);
        extension = 'json';
        mimeType = 'application/json';
        break;

      case 'sharegpt':
        content = this.toShareGPT(validData, options);
        extension = 'json';
        mimeType = 'application/json';
        break;

      case 'csv':
        content = this.toCSV(validData, options);
        extension = 'csv';
        mimeType = 'text/csv';
        break;

      case 'openai':
        content = JSON.stringify(this.toOpenAIChatFormat(validData, options), null, 2);
        extension = 'json';
        mimeType = 'application/json';
        break;

      default:
        return { success: false, error: `Formato não suportado: ${format}` };
    }

    // Criar blob e download
    const blob = new Blob([content], { type: mimeType });
    const filename = `whatshybrid-training-${format}-${new Date().toISOString().split('T')[0]}.${extension}`;

    this.lastExport = {
      format,
      count: validData.length,
      validation,
      filename,
      exportedAt: Date.now()
    };

    return {
      success: true,
      blob,
      filename,
      mimeType,
      count: validData.length,
      validation
    };
  }

  /**
   * Download direto do arquivo
   */
  async download(format, options = {}) {
    const result = await this.export(format, options);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);

    return result;
  }

  // ============================================
  // UTILS
  // ============================================

  /**
   * Obtém estatísticas do dataset
   */
  async getStats() {
    const data = await this.collectData();
    const validation = this.validate(data);

    const byCategory = {};
    const bySource = {};
    const qualityDist = { high: 0, medium: 0, low: 0 };

    data.forEach(item => {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      bySource[item.source] = (bySource[item.source] || 0) + 1;
      
      if (item.quality >= 8) qualityDist.high++;
      else if (item.quality >= 5) qualityDist.medium++;
      else qualityDist.low++;
    });

    return {
      total: data.length,
      ...validation.stats,
      byCategory,
      bySource,
      qualityDistribution: qualityDist,
      avgInputLength: Math.round(data.reduce((s, d) => s + d.input.length, 0) / data.length),
      avgOutputLength: Math.round(data.reduce((s, d) => s + d.output.length, 0) / data.length)
    };
  }

  /**
   * Obtém formatos disponíveis
   */
  getFormats() {
    return [
      { id: 'jsonl', name: 'JSONL (OpenAI Fine-tuning)', description: 'Formato padrão para fine-tuning OpenAI' },
      { id: 'alpaca', name: 'Alpaca', description: 'Formato para modelos Alpaca/Llama' },
      { id: 'sharegpt', name: 'ShareGPT', description: 'Formato ShareGPT para treinamento' },
      { id: 'csv', name: 'CSV', description: 'Planilha para análise' },
      { id: 'openai', name: 'OpenAI Chat', description: 'Formato de chat completion' }
    ];
  }
}

// Exportar
window.DatasetExporter = DatasetExporter;
window.datasetExporter = new DatasetExporter();
console.log('[DatasetExporter] ✅ Módulo de exportação para fine-tuning carregado');
