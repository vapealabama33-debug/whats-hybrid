/**
 * Training IA - WhatsHybrid
 * Interface completa para treinamento da IA
 * 
 * @version 1.0.0
 */

class TrainingApp {
  constructor() {
    this.examples = [];
    this.faqs = [];
    this.products = [];
    this.businessInfo = {};
    this.analytics = null;
    this.currentEditId = null;
    
    // Simulação Neural
    this.simulation = null;
    this.isSimulationRunning = false;
    
    this.init();
  }

  // ============================================
  // INICIALIZAÇÃO
  // ============================================
  
  async init() {
    console.log('[TrainingApp] Inicializando...');
    
    // Carregar dados
    await this.loadAllData();
    
    // Configurar event listeners
    this.setupEventListeners();
    
    // Renderizar conteúdo
    this.renderAll();
    
    // Atualizar status de conexão
    this.updateConnectionStatus();

    // Desabilitar integrações não implementadas
    const disabledIntegrations = ['btnConnectAirtable', 'btnConnectAPI'];
    disabledIntegrations.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = true;
        btn.title = 'Funcionalidade em desenvolvimento';
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      }
    });
    
    // Carregar analytics
    this.loadAnalytics();
    
    // Inicializar Simulação Neural
    this.initSimulation();
    
    console.log('[TrainingApp] ✅ Inicializado');
  }

  // ============================================
  // CARREGAR DADOS
  // ============================================
  
  async loadAllData() {
    try {
      // Carregar exemplos (few-shot)
      const examplesData = await chrome.storage.local.get('whl_few_shot_examples');
      // AI-008 FIX: Handle both string (new) and object (legacy) formats
      const rawExamples = examplesData.whl_few_shot_examples;
      if (typeof rawExamples === 'string') {
        try {
          this.examples = JSON.parse(rawExamples);
          console.log('[AI-008] ✅ Loaded examples from JSON string');
        } catch (e) {
          console.warn('[AI-008] Failed to parse examples string:', e);
          this.examples = [];
        }
      } else if (Array.isArray(rawExamples)) {
        this.examples = rawExamples;
        console.log('[AI-008] ⚠️ Loaded examples from legacy object format');
      } else {
        this.examples = [];
      }
      
      // Carregar knowledge base (FAQs, produtos, business)
      const kbData = await chrome.storage.local.get('whl_knowledge_base');
      const kb = kbData.whl_knowledge_base || {};
      
      // AI-007 FIX: Handle both field name variants for backward compatibility  
      // Checks new format first (faqs/products/businessInfo) for consistency
      this.faqs = kb.faqs || kb.faq || [];
      this.products = kb.products || [];
      this.businessInfo = kb.businessInfo || kb.business || {};
      
      console.log('[AI-007] ✅ KB loaded with backward compatibility (faq/faqs, business/businessInfo)');
      
      // Atualizar estatísticas
      this.updateStats();
      
      console.log('[TrainingApp] Dados carregados:', {
        examples: this.examples.length,
        faqs: this.faqs.length,
        products: this.products.length
      });
      
    } catch (error) {
      console.error('[TrainingApp] Erro ao carregar dados:', error);
      this.showToast('Erro ao carregar dados', 'error');
    }
  }

  // ============================================
  // SALVAR DADOS
  // ============================================
  
  async saveExamples() {
    try {
      // AI-008 FIX: Save as JSON string to match FewShotLearning's load expectation
      console.log('[AI-008] ✅ Saving examples as JSON string');
      await chrome.storage.local.set({ whl_few_shot_examples: JSON.stringify(this.examples) });
      console.log('[TrainingApp] Exemplos salvos');
    } catch (error) {
      console.error('[TrainingApp] Erro ao salvar exemplos:', error);
    }
  }

  async saveKnowledgeBase() {
    try {
      // AI-007 FIX: Load existing KB to preserve fields we don't manage
      console.log('[AI-007] Loading existing KB to preserve unmanaged fields...');
      const existing = await chrome.storage.local.get('whl_knowledge_base');
      let currentKB = existing.whl_knowledge_base || {};
      
      // Handle if stored as string
      if (typeof currentKB === 'string') {
        try {
          currentKB = JSON.parse(currentKB);
        } catch(e) {
          console.warn('[AI-007] Failed to parse existing KB, using empty object');
          currentKB = {};
        }
      }

      // AI-007 FIX: Merge with correct field names (faq not faqs, business not businessInfo)
      const kb = {
        ...currentKB, // Preserve existing fields (policies, tone, cannedReplies, documents, etc.)
        faq: this.faqs,           // Correct field name: 'faq' not 'faqs'
        products: this.products,
        business: this.businessInfo, // Correct field name: 'business' not 'businessInfo'
        lastUpdated: Date.now(),
        updatedAt: Date.now()        // Keep backward compatibility with old field name
      };
      
      console.log('[AI-007] ✅ Saving KB with correct schema (preserving unmanaged fields)');
      await chrome.storage.local.set({ whl_knowledge_base: kb });
      console.log('[TrainingApp] Knowledge base salva');
    } catch (error) {
      console.error('[TrainingApp] Erro ao salvar KB:', error);
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  
  setupEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });

    // Header buttons
    document.getElementById('btnSync')?.addEventListener('click', () => this.syncWithBackend());
    document.getElementById('btnImport')?.addEventListener('click', () => this.importData());
    document.getElementById('btnExport')?.addEventListener('click', () => this.exportData());

    // Exemplos
    document.getElementById('btnAddExample')?.addEventListener('click', () => this.openExampleModal());
    document.getElementById('btnSaveExample')?.addEventListener('click', () => this.saveExample());
    document.getElementById('btnDeleteExample')?.addEventListener('click', () => this.deleteExample());
    document.getElementById('btnCancelExample')?.addEventListener('click', () => this.closeModal('exampleModal'));
    document.getElementById('closeExampleModal')?.addEventListener('click', () => this.closeModal('exampleModal'));

    // FAQs
    document.getElementById('btnAddFaq')?.addEventListener('click', () => this.openFaqModal());
    document.getElementById('btnSaveFaq')?.addEventListener('click', () => this.saveFaq());
    document.getElementById('btnDeleteFaq')?.addEventListener('click', () => this.deleteFaq());
    document.getElementById('btnCancelFaq')?.addEventListener('click', () => this.closeModal('faqModal'));
    document.getElementById('closeFaqModal')?.addEventListener('click', () => this.closeModal('faqModal'));

    // Produtos
    document.getElementById('btnAddProduct')?.addEventListener('click', () => this.openProductModal());
    document.getElementById('btnSaveProduct')?.addEventListener('click', () => this.saveProduct());
    document.getElementById('btnDeleteProduct')?.addEventListener('click', () => this.deleteProduct());
    document.getElementById('btnCancelProduct')?.addEventListener('click', () => this.closeModal('productModal'));
    document.getElementById('closeProductModal')?.addEventListener('click', () => this.closeModal('productModal'));

    // Business Info
    document.getElementById('btnSaveBusiness')?.addEventListener('click', () => this.saveBusinessInfo());

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
      }
    });

    // ===== IMPORT TAB =====
    this.setupImportListeners();
    
    // ===== GAP DETECTOR TAB =====
    this.setupGapListeners();
    
    // ===== A/B TESTING TAB =====
    this.setupAbTestingListeners();
  }

  // ============================================
  // IMPORT LISTENERS
  // ============================================
  
  setupImportListeners() {
    // File upload zone
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    
    if (uploadZone && fileInput) {
      uploadZone.addEventListener('click', () => fileInput.click());
      uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
      });
      uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
      });
      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        this.handleFileUpload(e.dataTransfer.files);
      });
      fileInput.addEventListener('change', (e) => {
        this.handleFileUpload(e.target.files);
      });
    }

    // WhatsApp conversation upload
    const uploadZoneWpp = document.getElementById('uploadZoneWpp');
    const wppFileInput = document.getElementById('wppFileInput');
    
    if (uploadZoneWpp && wppFileInput) {
      uploadZoneWpp.addEventListener('click', () => wppFileInput.click());
      wppFileInput.addEventListener('change', (e) => {
        this.handleWhatsAppImport(e.target.files[0]);
      });
    }

    // External connectors
    document.getElementById('btnConnectSheets')?.addEventListener('click', () => {
      this.openModal('sheetsModal');
    });
    document.getElementById('btnConnectNotion')?.addEventListener('click', () => {
      this.openModal('notionModal');
    });
    document.getElementById('btnSaveSheets')?.addEventListener('click', () => this.connectGoogleSheets());
    document.getElementById('btnSaveNotion')?.addEventListener('click', () => this.connectNotion());
    document.getElementById('closeSheetsModal')?.addEventListener('click', () => this.closeModal('sheetsModal'));
    document.getElementById('closeNotionModal')?.addEventListener('click', () => this.closeModal('notionModal'));
    document.getElementById('btnCancelSheets')?.addEventListener('click', () => this.closeModal('sheetsModal'));
    document.getElementById('btnCancelNotion')?.addEventListener('click', () => this.closeModal('notionModal'));

    // Export formats
    document.querySelectorAll('.export-formats button').forEach(btn => {
      btn.addEventListener('click', () => this.exportToFormat(btn.dataset.format));
    });
  }

  // ============================================
  // GAP DETECTOR LISTENERS
  // ============================================
  
  setupGapListeners() {
    // Gaps são atualizados automaticamente ao mudar para a tab
  }

  // ============================================
  // A/B TESTING LISTENERS
  // ============================================
  
  setupAbTestingListeners() {
    document.getElementById('btnNewTest')?.addEventListener('click', () => {
      this.openModal('abTestModal');
    });
    document.getElementById('btnCreateAbTest')?.addEventListener('click', () => this.createAbTest());
    document.getElementById('btnCancelAbTest')?.addEventListener('click', () => this.closeModal('abTestModal'));
    document.getElementById('closeAbTestModal')?.addEventListener('click', () => this.closeModal('abTestModal'));
  }

  // ============================================
  // TABS
  // ============================================
  
  switchTab(tabId) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    });

    // Refresh content
    switch (tabId) {
      case 'simulation':
        // Simulação Neural - já inicializada no constructor
        break;
      case 'examples':
        this.renderExamples();
        break;
      case 'faqs':
        this.renderFaqs();
        break;
      case 'products':
        this.renderProducts();
        break;
      case 'business':
        this.loadBusinessForm();
        break;
      case 'import':
        this.renderImportTab();
        break;
      case 'voice':
        this.initVoiceTraining();
        break;
      case 'gaps':
        this.renderGapsTab();
        break;
      case 'abtesting':
        this.renderAbTestingTab();
        break;
      case 'analytics':
        this.loadAnalytics();
        break;
    }
  }

  // ============================================
  // RENDER
  // ============================================
  
  renderAll() {
    this.renderExamples();
    this.renderFaqs();
    this.renderProducts();
    this.loadBusinessForm();
    this.updateStats();
  }

  renderExamples() {
    const grid = document.getElementById('examplesGrid');
    const empty = document.getElementById('emptyExamples');

    if (!grid) return;

    if (this.examples.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }

    if (empty) empty.style.display = 'none';

    // SECURITY FIX (NOTAUDIT-001): Remover onclick inline para evitar XSS
    // Usar event delegation ao invés de interpolar IDs diretamente
    grid.innerHTML = this.examples.map(ex => `
      <div class="example-card" data-id="${parseInt(ex.id) || 0}">
        <div class="example-header">
          <span class="example-category">${this.escapeHtml(ex.category || 'Geral')}</span>
          <div class="example-quality">
            <span class="stars">${'★'.repeat(Math.round((ex.quality || 8) / 2))}</span>
            <span>${ex.quality || 8}/10</span>
          </div>
        </div>
        <div class="example-input">${this.escapeHtml(ex.input || ex.user || '').substring(0, 150)}${(ex.input || ex.user || '').length > 150 ? '...' : ''}</div>
        <div class="example-output">${this.escapeHtml(ex.output || ex.response || '').substring(0, 200)}${(ex.output || ex.response || '').length > 200 ? '...' : ''}</div>
        <div class="example-footer">
          <div class="example-tags">
            ${(ex.tags || []).slice(0, 4).map(tag => `<span class="example-tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
          <div class="example-stats">
            <span>📊 ${ex.usageCount || 0}x usado</span>
          </div>
        </div>
      </div>
    `).join('');

    // SECURITY FIX: Event delegation para clicks
    grid.removeEventListener('click', this._handleExampleClick);
    this._handleExampleClick = (e) => {
      const card = e.target.closest('.example-card');
      if (card) {
        const id = parseInt(card.dataset.id);
        if (!isNaN(id)) this.openExampleModal(id);
      }
    };
    grid.addEventListener('click', this._handleExampleClick);
  }

  renderFaqs() {
    const list = document.getElementById('faqsList');
    const empty = document.getElementById('emptyFaqs');

    if (!list) return;

    if (this.faqs.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }

    if (empty) empty.style.display = 'none';

    // SECURITY FIX (NOTAUDIT-001): Remover onclick inline para evitar XSS
    list.innerHTML = this.faqs.map(faq => `
      <div class="faq-card" data-id="${parseInt(faq.id) || 0}">
        <div class="faq-question">${this.escapeHtml(faq.q || faq.question || '')}</div>
        <div class="faq-answer">${this.escapeHtml(faq.a || faq.answer || '')}</div>
        ${faq.keywords?.length ? `
          <div class="faq-keywords">
            ${faq.keywords.map(k => `<span class="faq-keyword">${this.escapeHtml(k)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');

    // SECURITY FIX: Event delegation para clicks
    list.removeEventListener('click', this._handleFaqClick);
    this._handleFaqClick = (e) => {
      const card = e.target.closest('.faq-card');
      if (card) {
        const id = parseInt(card.dataset.id);
        if (!isNaN(id)) this.openFaqModal(id);
      }
    };
    list.addEventListener('click', this._handleFaqClick);
  }

  renderProducts() {
    const grid = document.getElementById('productsGrid');
    const empty = document.getElementById('emptyProducts');

    if (!grid) return;

    if (this.products.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }

    if (empty) empty.style.display = 'none';

    // SECURITY FIX (NOTAUDIT-001): Remover onclick inline para evitar XSS
    grid.innerHTML = this.products.map(p => {
      const availabilityLabels = {
        available: 'Disponível',
        low_stock: 'Estoque Baixo',
        out_of_stock: 'Esgotado',
        pre_order: 'Pré-venda'
      };

      return `
        <div class="product-card" data-id="${parseInt(p.id) || 0}">
          <div class="product-header">
            <div>
              <div class="product-name">${this.escapeHtml(p.name || '')}</div>
              ${p.sku ? `<div class="product-sku">SKU: ${this.escapeHtml(p.sku)}</div>` : ''}
            </div>
            <span class="product-availability ${p.availability || 'available'}">
              ${availabilityLabels[p.availability] || 'Disponível'}
            </span>
          </div>
          <div class="product-description">${this.escapeHtml((p.description || '').substring(0, 100))}${(p.description || '').length > 100 ? '...' : ''}</div>
          <div class="product-price">
            <span class="current">R$ ${(p.promoPrice || p.price || 0).toFixed(2)}</span>
            ${p.promoPrice && p.price ? `<span class="original">R$ ${p.price.toFixed(2)}</span>` : ''}
          </div>
          ${p.category ? `<div class="product-category">📁 ${this.escapeHtml(p.category)}</div>` : ''}
        </div>
      `;
    }).join('');

    // SECURITY FIX: Event delegation para clicks
    grid.removeEventListener('click', this._handleProductClick);
    this._handleProductClick = (e) => {
      const card = e.target.closest('.product-card');
      if (card) {
        const id = parseInt(card.dataset.id);
        if (!isNaN(id)) this.openProductModal(id);
      }
    };
    grid.addEventListener('click', this._handleProductClick);
  }

  loadBusinessForm() {
    const bi = this.businessInfo;
    
    document.getElementById('businessName')?.setAttribute('value', bi.name || '');
    document.getElementById('businessSegment')?.setAttribute('value', bi.segment || '');
    
    const descEl = document.getElementById('businessDescription');
    if (descEl) descEl.value = bi.description || '';
    
    document.getElementById('businessHours')?.setAttribute('value', bi.hours || '');
    document.getElementById('businessResponseTime')?.setAttribute('value', bi.responseTime || '');
    document.getElementById('businessPhone')?.setAttribute('value', bi.phone || '');
    document.getElementById('businessEmail')?.setAttribute('value', bi.email || '');
    
    const deliveryEl = document.getElementById('deliveryPolicy');
    if (deliveryEl) deliveryEl.value = bi.deliveryPolicy || '';
    
    document.getElementById('freeShipping')?.setAttribute('value', bi.freeShipping || '');
    
    const returnEl = document.getElementById('returnPolicy');
    if (returnEl) returnEl.value = bi.returnPolicy || '';
    
    const customEl = document.getElementById('customInstructions');
    if (customEl) customEl.value = bi.customInstructions || '';
    
    // Payment methods
    const payments = bi.paymentMethods || [];
    document.querySelectorAll('#paymentMethods input').forEach(input => {
      input.checked = payments.includes(input.value);
    });
  }

  // ============================================
  // MODALS - EXEMPLOS
  // ============================================
  
  openExampleModal(id = null) {
    const modal = document.getElementById('exampleModal');
    const titleEl = document.getElementById('exampleModalTitle');
    const deleteBtn = document.getElementById('btnDeleteExample');
    
    if (id) {
      const example = this.examples.find(e => e.id === id);
      if (!example) return;
      
      this.currentEditId = id;
      titleEl.textContent = 'Editar Exemplo';
      deleteBtn.style.display = 'block';
      
      document.getElementById('exampleId').value = id;
      document.getElementById('exampleCategory').value = example.category || 'geral';
      document.getElementById('exampleInput').value = example.input || example.user || '';
      document.getElementById('exampleOutput').value = example.output || example.response || '';
      document.getElementById('exampleIntent').value = example.intent || '';
      document.getElementById('exampleQuality').value = example.quality || 8;
      document.getElementById('exampleTags').value = (example.tags || []).join(', ');
    } else {
      this.currentEditId = null;
      titleEl.textContent = 'Novo Exemplo';
      deleteBtn.style.display = 'none';
      
      document.getElementById('exampleForm').reset();
      document.getElementById('exampleQuality').value = 8;
    }
    
    modal.classList.add('active');
  }

  async saveExample() {
    const input = document.getElementById('exampleInput').value.trim();
    const output = document.getElementById('exampleOutput').value.trim();
    
    if (!input || !output) {
      this.showToast('Preencha a mensagem e a resposta', 'warning');
      return;
    }
    
    const example = {
      id: this.currentEditId || Date.now(),
      category: document.getElementById('exampleCategory').value,
      input: input,
      user: input, // Compatibilidade
      output: output,
      response: output, // Compatibilidade
      intent: document.getElementById('exampleIntent').value || null,
      quality: parseInt(document.getElementById('exampleQuality').value) || 8,
      tags: document.getElementById('exampleTags').value.split(',').map(t => t.trim()).filter(t => t),
      createdAt: this.currentEditId ? (this.examples.find(e => e.id === this.currentEditId)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now(),
      usageCount: this.currentEditId ? (this.examples.find(e => e.id === this.currentEditId)?.usageCount || 0) : 0,
      score: (parseInt(document.getElementById('exampleQuality').value) || 8) / 10
    };
    
    if (this.currentEditId) {
      const index = this.examples.findIndex(e => e.id === this.currentEditId);
      if (index !== -1) {
        this.examples[index] = example;
      }
    } else {
      this.examples.push(example);
    }
    
    await this.saveExamples();
    this.renderExamples();
    this.updateStats();
    this.closeModal('exampleModal');
    this.showToast(this.currentEditId ? 'Exemplo atualizado!' : 'Exemplo adicionado!', 'success');
  }

  async deleteExample() {
    if (!this.currentEditId) return;
    
    if (!confirm('Tem certeza que deseja excluir este exemplo?')) return;
    
    this.examples = this.examples.filter(e => e.id !== this.currentEditId);
    await this.saveExamples();
    this.renderExamples();
    this.updateStats();
    this.closeModal('exampleModal');
    this.showToast('Exemplo excluído', 'success');
  }

  // ============================================
  // MODALS - FAQs
  // ============================================
  
  openFaqModal(id = null) {
    const modal = document.getElementById('faqModal');
    const titleEl = document.getElementById('faqModalTitle');
    const deleteBtn = document.getElementById('btnDeleteFaq');
    
    if (id) {
      const faq = this.faqs.find(f => f.id === id);
      if (!faq) return;
      
      this.currentEditId = id;
      titleEl.textContent = 'Editar FAQ';
      deleteBtn.style.display = 'block';
      
      document.getElementById('faqId').value = id;
      document.getElementById('faqQuestion').value = faq.q || faq.question || '';
      document.getElementById('faqAnswer').value = faq.a || faq.answer || '';
      document.getElementById('faqKeywords').value = (faq.keywords || []).join(', ');
    } else {
      this.currentEditId = null;
      titleEl.textContent = 'Nova FAQ';
      deleteBtn.style.display = 'none';
      document.getElementById('faqForm').reset();
    }
    
    modal.classList.add('active');
  }

  async saveFaq() {
    const question = document.getElementById('faqQuestion').value.trim();
    const answer = document.getElementById('faqAnswer').value.trim();
    
    if (!question || !answer) {
      this.showToast('Preencha a pergunta e a resposta', 'warning');
      return;
    }
    
    const faq = {
      id: this.currentEditId || Date.now(),
      q: question,
      question: question,
      a: answer,
      answer: answer,
      keywords: document.getElementById('faqKeywords').value.split(',').map(k => k.trim().toLowerCase()).filter(k => k),
      createdAt: this.currentEditId ? (this.faqs.find(f => f.id === this.currentEditId)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };
    
    if (this.currentEditId) {
      const index = this.faqs.findIndex(f => f.id === this.currentEditId);
      if (index !== -1) {
        this.faqs[index] = faq;
      }
    } else {
      this.faqs.push(faq);
    }
    
    await this.saveKnowledgeBase();
    this.renderFaqs();
    this.updateStats();
    this.closeModal('faqModal');
    this.showToast(this.currentEditId ? 'FAQ atualizada!' : 'FAQ adicionada!', 'success');
  }

  async deleteFaq() {
    if (!this.currentEditId) return;
    
    if (!confirm('Tem certeza que deseja excluir esta FAQ?')) return;
    
    this.faqs = this.faqs.filter(f => f.id !== this.currentEditId);
    await this.saveKnowledgeBase();
    this.renderFaqs();
    this.updateStats();
    this.closeModal('faqModal');
    this.showToast('FAQ excluída', 'success');
  }

  // ============================================
  // MODALS - PRODUTOS
  // ============================================
  
  openProductModal(id = null) {
    const modal = document.getElementById('productModal');
    const titleEl = document.getElementById('productModalTitle');
    const deleteBtn = document.getElementById('btnDeleteProduct');
    
    if (id) {
      const product = this.products.find(p => p.id === id);
      if (!product) return;
      
      this.currentEditId = id;
      titleEl.textContent = 'Editar Produto';
      deleteBtn.style.display = 'block';
      
      document.getElementById('productId').value = id;
      document.getElementById('productName').value = product.name || '';
      document.getElementById('productSku').value = product.sku || '';
      document.getElementById('productDescription').value = product.description || '';
      document.getElementById('productPrice').value = product.price || '';
      document.getElementById('productPromoPrice').value = product.promoPrice || '';
      document.getElementById('productCategory').value = product.category || '';
      document.getElementById('productAvailability').value = product.availability || 'available';
      document.getElementById('productInfo').value = product.info || '';
    } else {
      this.currentEditId = null;
      titleEl.textContent = 'Novo Produto';
      deleteBtn.style.display = 'none';
      document.getElementById('productForm').reset();
    }
    
    modal.classList.add('active');
  }

  async saveProduct() {
    const name = document.getElementById('productName').value.trim();
    
    if (!name) {
      this.showToast('Preencha o nome do produto', 'warning');
      return;
    }
    
    const product = {
      id: this.currentEditId || Date.now(),
      name: name,
      sku: document.getElementById('productSku').value.trim(),
      description: document.getElementById('productDescription').value.trim(),
      price: parseFloat(document.getElementById('productPrice').value) || 0,
      promoPrice: parseFloat(document.getElementById('productPromoPrice').value) || null,
      category: document.getElementById('productCategory').value.trim(),
      availability: document.getElementById('productAvailability').value,
      info: document.getElementById('productInfo').value.trim(),
      createdAt: this.currentEditId ? (this.products.find(p => p.id === this.currentEditId)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };
    
    if (this.currentEditId) {
      const index = this.products.findIndex(p => p.id === this.currentEditId);
      if (index !== -1) {
        this.products[index] = product;
      }
    } else {
      this.products.push(product);
    }
    
    await this.saveKnowledgeBase();
    this.renderProducts();
    this.updateStats();
    this.closeModal('productModal');
    this.showToast(this.currentEditId ? 'Produto atualizado!' : 'Produto adicionado!', 'success');
  }

  async deleteProduct() {
    if (!this.currentEditId) return;
    
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    
    this.products = this.products.filter(p => p.id !== this.currentEditId);
    await this.saveKnowledgeBase();
    this.renderProducts();
    this.updateStats();
    this.closeModal('productModal');
    this.showToast('Produto excluído', 'success');
  }

  // ============================================
  // BUSINESS INFO
  // ============================================
  
  async saveBusinessInfo() {
    const paymentMethods = [];
    document.querySelectorAll('#paymentMethods input:checked').forEach(input => {
      paymentMethods.push(input.value);
    });

    this.businessInfo = {
      name: document.getElementById('businessName').value.trim(),
      segment: document.getElementById('businessSegment').value.trim(),
      description: document.getElementById('businessDescription').value.trim(),
      hours: document.getElementById('businessHours').value.trim(),
      responseTime: document.getElementById('businessResponseTime').value.trim(),
      phone: document.getElementById('businessPhone').value.trim(),
      email: document.getElementById('businessEmail').value.trim(),
      paymentMethods: paymentMethods,
      deliveryPolicy: document.getElementById('deliveryPolicy').value.trim(),
      freeShipping: document.getElementById('freeShipping').value.trim(),
      returnPolicy: document.getElementById('returnPolicy').value.trim(),
      customInstructions: document.getElementById('customInstructions').value.trim(),
      updatedAt: Date.now()
    };
    
    await this.saveKnowledgeBase();
    this.showToast('Configurações salvas!', 'success');
  }

  // ============================================
  // ANALYTICS
  // ============================================
  
  async loadAnalytics() {
    try {
      // Carregar dados de analytics
      const data = await chrome.storage.local.get([
        'whl_ai_analytics',
        'whl_ai_feedback_system',
        'whl_ai_response_cache',
        'whl_ai_auto_learner'
      ]);
      
      const analytics = data.whl_ai_analytics ? JSON.parse(data.whl_ai_analytics) : {};
      const feedback = data.whl_ai_feedback_system ? JSON.parse(data.whl_ai_feedback_system) : {};
      const cache = data.whl_ai_response_cache ? JSON.parse(data.whl_ai_response_cache) : {};
      const autoLearner = data.whl_ai_auto_learner ? JSON.parse(data.whl_ai_auto_learner) : {};
      
      // Atualizar métricas
      const today = new Date().toISOString().split('T')[0];
      const todayStats = analytics.dailyStats?.[today] || {};
      
      document.getElementById('overallScore').textContent = 
        `${Math.round((todayStats.qualityScore || 0) * 100)}%`;
      
      document.getElementById('acceptanceRate').textContent = 
        `${Math.round((todayStats.acceptanceRate || 0) * 100)}%`;
      
      const cacheMetrics = cache.metrics || {};
      const cacheTotal = (cacheMetrics.hits || 0) + (cacheMetrics.misses || 0);
      const hitRate = cacheTotal > 0 ? (cacheMetrics.hits / cacheTotal) : 0;
      document.getElementById('cacheHitRate').textContent = 
        `${Math.round(hitRate * 100)}%`;
      
      document.getElementById('autoLearnedToday').textContent = 
        (autoLearner.metrics?.examplesAdded || 0).toString();
      
      // Renderizar gráfico
      this.renderChart(analytics.dailyStats || {});
      
      // Renderizar alertas
      this.renderAlerts(analytics.alerts || []);
      
      // Renderizar intenções
      this.renderIntents(todayStats);

      // Renderizar scores por categoria
      this.renderCategoryScores();

      // Renderizar métricas de sentimento
      this.renderSentimentMetrics();
      
    } catch (error) {
      console.error('[TrainingApp] Erro ao carregar analytics:', error);
    }
  }

  renderChart(dailyStats) {
    const container = document.getElementById('chartBars');
    if (!container) return;
    
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    
    const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    let maxValue = 1;
    days.forEach(d => {
      const val = dailyStats[d]?.suggestionsUsed || 0;
      if (val > maxValue) maxValue = val;
    });
    
    container.innerHTML = days.map(d => {
      const stats = dailyStats[d] || {};
      const value = stats.suggestionsUsed || 0;
      const height = (value / maxValue) * 100;
      const dayOfWeek = dayLabels[new Date(d + 'T12:00:00').getDay()];
      
      return `<div class="chart-bar" style="height: ${Math.max(height, 5)}%" data-label="${dayOfWeek}" data-value="${value}"></div>`;
    }).join('');
  }

  renderAlerts(alerts) {
    const container = document.getElementById('alertsList');
    if (!container) return;
    
    if (alerts.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">Nenhum alerta recente</p>';
      return;
    }
    
    container.innerHTML = alerts.slice(-5).reverse().map(alert => {
      const typeClass = alert.type || 'info';
      const icons = {
        warning: '⚠️',
        success: '✅',
        error: '❌',
        info: 'ℹ️'
      };
      
      return `
        <div class="alert-item ${typeClass}">
          <span class="alert-icon">${icons[typeClass] || 'ℹ️'}</span>
          <div class="alert-content">
            <div class="alert-message">${this.escapeHtml(alert.message)}</div>
            ${alert.suggestion ? `<div class="alert-suggestion">${this.escapeHtml(alert.suggestion)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  renderIntents(stats) {
    const container = document.getElementById('intentsList');
    if (!container) return;
    
    // Simular dados de intenções (em produção, viria do analytics)
    const intents = [
      { name: 'Pergunta sobre Preço', count: stats.suggestionsUsed || 0 },
      { name: 'Saudação', count: Math.floor((stats.suggestionsUsed || 0) * 0.8) },
      { name: 'Dúvida sobre Produto', count: Math.floor((stats.suggestionsUsed || 0) * 0.6) },
      { name: 'Suporte', count: Math.floor((stats.suggestionsUsed || 0) * 0.4) }
    ].filter(i => i.count > 0);
    
    if (intents.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">Sem dados de intenções ainda</p>';
      return;
    }
    
    container.innerHTML = intents.map(intent => `
      <div class="intent-item">
        <span class="intent-name">${intent.name}</span>
        <span class="intent-count">${intent.count}</span>
      </div>
    `).join('');
  }

  // ============================================
  // ESTATÍSTICAS
  // ============================================
  
  updateStats() {
    document.getElementById('statExamples').textContent = this.examples.length;
    document.getElementById('statFaqs').textContent = this.faqs.length;
    document.getElementById('statProducts').textContent = this.products.length;
    
    // Calcular precisão média baseada na qualidade dos exemplos
    if (this.examples.length > 0) {
      const avgQuality = this.examples.reduce((sum, ex) => sum + (ex.quality || 8), 0) / this.examples.length;
      document.getElementById('statAccuracy').textContent = `${Math.round(avgQuality * 10)}%`;
    }
    
    // Auto-aprendidos (vem do auto-learner)
    chrome.storage.local.get('whl_ai_auto_learner').then(data => {
      const autoLearner = data.whl_ai_auto_learner ? JSON.parse(data.whl_ai_auto_learner) : {};
      document.getElementById('statAutoLearn').textContent = (autoLearner.metrics?.examplesAdded || 0).toString();
    });
  }

  // ============================================
  // SEARCH
  // ============================================
  
  handleSearch(query) {
    const q = query.toLowerCase().trim();
    
    // Filtrar exemplos
    const filteredExamples = this.examples.filter(ex => 
      (ex.input || '').toLowerCase().includes(q) ||
      (ex.output || '').toLowerCase().includes(q) ||
      (ex.category || '').toLowerCase().includes(q) ||
      (ex.tags || []).some(t => t.toLowerCase().includes(q))
    );
    
    // Filtrar FAQs
    const filteredFaqs = this.faqs.filter(faq =>
      (faq.q || faq.question || '').toLowerCase().includes(q) ||
      (faq.a || faq.answer || '').toLowerCase().includes(q) ||
      (faq.keywords || []).some(k => k.includes(q))
    );
    
    // Filtrar produtos
    const filteredProducts = this.products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    );
    
    // Re-renderizar com filtrados
    this.renderFilteredExamples(filteredExamples);
    this.renderFilteredFaqs(filteredFaqs);
    this.renderFilteredProducts(filteredProducts);
  }

  renderFilteredExamples(examples) {
    const grid = document.getElementById('examplesGrid');
    const empty = document.getElementById('emptyExamples');
    if (!grid) return;

    if (examples.length === 0 && this.examples.length > 0) {
      grid.innerHTML = '<p style="padding: 20px; color: var(--text-muted);">Nenhum exemplo encontrado para esta busca</p>';
      if (empty) empty.style.display = 'none';
      return;
    }

    // Usar o array filtrado para renderizar
    const original = this.examples;
    this.examples = examples;
    this.renderExamples();
    this.examples = original;
  }

  renderFilteredFaqs(faqs) {
    const list = document.getElementById('faqsList');
    if (!list) return;

    if (faqs.length === 0 && this.faqs.length > 0) {
      list.innerHTML = '<p style="padding: 20px; color: var(--text-muted);">Nenhuma FAQ encontrada para esta busca</p>';
      return;
    }

    const original = this.faqs;
    this.faqs = faqs;
    this.renderFaqs();
    this.faqs = original;
  }

  renderFilteredProducts(products) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (products.length === 0 && this.products.length > 0) {
      grid.innerHTML = '<p style="padding: 20px; color: var(--text-muted);">Nenhum produto encontrado para esta busca</p>';
      return;
    }

    const original = this.products;
    this.products = products;
    this.renderProducts();
    this.products = original;
  }

  // ============================================
  // IMPORT / EXPORT
  // ============================================
  
  async importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // SECURITY FIX (NOTAUDIT-001): Validar estrutura e prevenir prototype pollution
        if (data.__proto__ || data.constructor || data.prototype) {
          throw new Error('Invalid data structure: prototype pollution attempt detected');
        }

        // Validar e sanitizar examples
        if (data.examples && Array.isArray(data.examples)) {
          const validExamples = data.examples.filter(ex => this._validateExample(ex));
          this.examples = [...this.examples, ...validExamples];
          await this.saveExamples();
        }

        // Validar e sanitizar FAQs
        if (data.faqs && Array.isArray(data.faqs)) {
          const validFaqs = data.faqs.filter(faq => this._validateFaq(faq));
          this.faqs = [...this.faqs, ...validFaqs];
        }

        // Validar e sanitizar products
        if (data.products && Array.isArray(data.products)) {
          const validProducts = data.products.filter(p => this._validateProduct(p));
          this.products = [...this.products, ...validProducts];
        }

        // Validar e sanitizar businessInfo
        if (data.businessInfo && typeof data.businessInfo === 'object') {
          const safeBusinessInfo = this._sanitizeBusinessInfo(data.businessInfo);
          this.businessInfo = { ...this.businessInfo, ...safeBusinessInfo };
        }

        await this.saveKnowledgeBase();
        this.renderAll();
        this.showToast('Dados importados com sucesso!', 'success');

      } catch (error) {
        console.error('[TrainingApp] Erro ao importar:', error);
        this.showToast('Erro ao importar arquivo: ' + error.message, 'error');
      }
    };

    input.click();
  }

  // SECURITY FIX: Validação de dados importados
  _validateExample(ex) {
    return ex &&
           typeof ex === 'object' &&
           !ex.__proto__ &&
           (ex.input || ex.user) &&
           (ex.output || ex.response) &&
           (!ex.id || typeof ex.id === 'number' || typeof ex.id === 'string');
  }

  _validateFaq(faq) {
    return faq &&
           typeof faq === 'object' &&
           !faq.__proto__ &&
           (faq.q || faq.question) &&
           (faq.a || faq.answer) &&
           (!faq.id || typeof faq.id === 'number' || typeof faq.id === 'string');
  }

  _validateProduct(p) {
    return p &&
           typeof p === 'object' &&
           !p.__proto__ &&
           p.name &&
           typeof p.name === 'string' &&
           (!p.price || typeof p.price === 'number') &&
           (!p.id || typeof p.id === 'number' || typeof p.id === 'string');
  }

  _sanitizeBusinessInfo(data) {
    const allowed = ['name', 'segment', 'description', 'hours', 'responseTime', 'phone', 'email',
                     'deliveryPolicy', 'freeShipping', 'returnPolicy', 'customInstructions', 'paymentMethods'];
    const safe = {};

    for (const key of allowed) {
      if (data[key] !== undefined && data[key] !== null) {
        // Apenas tipos primitivos ou arrays simples
        if (typeof data[key] === 'string' || typeof data[key] === 'number' || typeof data[key] === 'boolean') {
          safe[key] = data[key];
        } else if (Array.isArray(data[key])) {
          safe[key] = data[key].filter(v => typeof v === 'string');
        }
      }
    }

    return safe;
  }

  exportData() {
    const data = {
      examples: this.examples,
      faqs: this.faqs,
      products: this.products,
      businessInfo: this.businessInfo,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatshybrid-training-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.showToast('Dados exportados!', 'success');
  }

  // ============================================
  // SYNC COM BACKEND
  // ============================================
  
  async syncWithBackend() {
    try {
      this.showToast('Sincronizando...', 'info');
      
      // Enviar dados para o backend via message para o background script
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_TRAINING_DATA',
        data: {
          examples: this.examples,
          faqs: this.faqs,
          products: this.products,
          businessInfo: this.businessInfo
        }
      });
      
      if (response?.success) {
        this.showToast('Sincronizado com sucesso!', 'success');
        this.updateConnectionStatus(true);
      } else {
        this.showToast('Falha na sincronização', 'warning');
      }
      
    } catch (error) {
      console.error('[TrainingApp] Erro ao sincronizar:', error);
      this.showToast('Erro ao sincronizar', 'error');
    }
  }

  // ============================================
  // UTILS
  // ============================================
  
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
    this.currentEditId = null;
  }

  updateConnectionStatus(connected = false) {
    const status = document.getElementById('connectionStatus');
    const statusText = status?.querySelector('.status-text');
    
    if (status) {
      status.classList.toggle('connected', connected);
      if (statusText) {
        statusText.textContent = connected ? 'Conectado' : 'Offline';
      }
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${this.escapeHtml(message)}`;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'toastIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================
  // SIMULAÇÃO NEURAL
  // ============================================

  initSimulation() {
    // Verificar se o SimulationEngine está disponível
    if (typeof SimulationEngine === 'undefined') {
      console.warn('[TrainingApp] SimulationEngine não disponível');
      return;
    }

    this.simulation = new SimulationEngine();

    // Configurar event handlers
    this.simulation.on('simulation:started', (data) => {
      this.onSimulationStarted(data);
    });

    this.simulation.on('simulation:paused', (data) => {
      this.onSimulationPaused(data);
    });

    this.simulation.on('simulation:resumed', (data) => {
      this.onSimulationResumed(data);
    });

    this.simulation.on('simulation:stopped', (data) => {
      this.onSimulationStopped(data);
    });

    this.simulation.on('message:simulator', (message) => {
      this.addChatMessage(message, 'simulator');
    });

    this.simulation.on('message:executor', (message) => {
      this.addChatMessage(message, 'executor');
      this.updateCurationSection();
    });

    this.simulation.on('response:approved', (data) => {
      this.updateMessageStatus(data.message.id, 'approved');
      this.updateCurationStats();
    });

    this.simulation.on('response:rejected', (data) => {
      this.updateMessageStatus(data.message.id, 'rejected');
      this.updateCurationStats();
    });

    // Setup botões
    this.setupSimulationButtons();

    console.log('[TrainingApp] ✅ Simulação Neural inicializada');
  }

  // ============================================
  // TREINAMENTO POR VOZ
  // ============================================
  
  async initVoiceTraining() {
    // Verificar se já foi inicializado
    if (this.voiceTraining) {
      console.log('[TrainingApp] Voice Training já inicializado');
      return;
    }

    // Verificar se WHLInteractiveTraining está disponível
    if (typeof WHLInteractiveTraining === 'undefined') {
      console.warn('[TrainingApp] WHLInteractiveTraining não disponível');
      const container = document.getElementById('voiceTrainingContainer');
      if (container) {
        container.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#9CA3AF;">
            <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
            <p>Módulo de treinamento por voz não carregado.</p>
            <p>Recarregue a página para tentar novamente.</p>
          </div>
        `;
      }
      return;
    }

    try {
      this.voiceTraining = new WHLInteractiveTraining({
        language: 'pt-BR',
        onExampleAdded: (example) => {
          console.log('[TrainingApp] Exemplo adicionado via voz:', example);
          // Sincronizar com a lista de exemplos
          this.examples.push({
            id: example.id,
            userMessage: example.user,
            aiResponse: example.assistant,
            source: 'voice_training',
            createdAt: example.createdAt
          });
          this.saveExamples();
          this.updateStats();
        }
      });

      await this.voiceTraining.init('voiceTrainingContainer');
      console.log('[TrainingApp] ✅ Voice Training inicializado');
      
    } catch (error) {
      console.error('[TrainingApp] Erro ao inicializar Voice Training:', error);
      this.showToast('Erro ao inicializar treinamento por voz', 'error');
    }
  }

  setupSimulationButtons() {
    // Botão Iniciar
    document.getElementById('btnStartSim')?.addEventListener('click', () => {
      this.startSimulation();
    });

    // Botão Pausar
    document.getElementById('btnPauseSim')?.addEventListener('click', () => {
      this.pauseSimulation();
    });

    // Botão Parar
    document.getElementById('btnStopSim')?.addEventListener('click', () => {
      this.stopSimulation();
    });

    // Botão Próximo
    document.getElementById('btnNextTurn')?.addEventListener('click', () => {
      this.nextTurn();
    });

    // Botão Salvar Aprovadas
    document.getElementById('btnSaveApproved')?.addEventListener('click', () => {
      this.saveApprovedResponses();
    });

    // Botão Conectar Executor
    document.getElementById('btnConnectExecutor')?.addEventListener('click', () => {
      this.connectExecutor();
    });

    // Botão Conectar Simulator
    document.getElementById('btnConnectSimulator')?.addEventListener('click', () => {
      this.connectSimulator();
    });

    // Teste Rápido
    document.getElementById('btnQuickTest')?.addEventListener('click', () => {
      this.runQuickTest();
    });

    document.getElementById('quickTestInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.runQuickTest();
      }
    });
  }

  async startSimulation() {
    if (!this.simulation) {
      this.showToast('Motor de simulação não disponível', 'error');
      return;
    }

    const theme = document.getElementById('simTheme')?.value || 'venda_abordagem';
    const executorProfile = document.getElementById('executorProfile')?.value || 'vendedor_senior';
    const simulatorProfile = document.getElementById('simulatorProfile')?.value || 'cliente_simulado';

    try {
      // Limpar chat
      this.clearChat();

      await this.simulation.start({
        theme,
        executorProfile,
        simulatorProfile
      });

      this.isSimulationRunning = true;
      this.updateSimulationButtons(true, false);
      this.showToast('Simulação iniciada!', 'success');

    } catch (error) {
      console.error('[TrainingApp] Erro ao iniciar simulação:', error);
      this.showToast('Erro ao iniciar simulação', 'error');
    }
  }

  pauseSimulation() {
    if (!this.simulation || !this.isSimulationRunning) return;

    if (this.simulation.isPaused()) {
      this.simulation.resume();
      this.updateSimulationButtons(true, false);
      this.showToast('Simulação retomada', 'info');
    } else {
      this.simulation.pause();
      this.updateSimulationButtons(true, true);
      this.showToast('Simulação pausada', 'info');
    }
  }

  stopSimulation() {
    if (!this.simulation) return;

    this.simulation.stop();
    this.isSimulationRunning = false;
    this.updateSimulationButtons(false, false);
    this.showToast('Simulação encerrada', 'info');
  }

  async nextTurn() {
    if (!this.simulation || !this.isSimulationRunning) return;

    await this.simulation.nextTurn();
  }

  updateSimulationButtons(running, paused) {
    const btnStart = document.getElementById('btnStartSim');
    const btnPause = document.getElementById('btnPauseSim');
    const btnStop = document.getElementById('btnStopSim');
    const btnNext = document.getElementById('btnNextTurn');
    const themeSelect = document.getElementById('simTheme');

    if (btnStart) btnStart.disabled = running;
    if (btnPause) {
      btnPause.disabled = !running;
      btnPause.textContent = paused ? '▶️ Continuar' : '⏸️ Pausar';
    }
    if (btnStop) btnStop.disabled = !running;
    if (btnNext) btnNext.disabled = !running || paused;
    if (themeSelect) themeSelect.disabled = running;

    // Status dos robôs
    const executorStatus = document.getElementById('executorStatus');
    const simulatorStatus = document.getElementById('simulatorStatus');

    if (running) {
      if (executorStatus) executorStatus.textContent = paused ? 'Pausado' : 'Simulando...';
      if (simulatorStatus) simulatorStatus.textContent = paused ? 'Pausado' : 'Simulando...';
    } else {
      if (executorStatus) executorStatus.textContent = 'Aguardando...';
      if (simulatorStatus) simulatorStatus.textContent = 'Aguardando...';
    }
  }

  onSimulationStarted(data) {
    console.log('[TrainingApp] Simulação iniciada:', data);
    
    // Mostrar seção de curadoria
    const curationSection = document.getElementById('curationSection');
    if (curationSection) curationSection.style.display = 'block';
  }

  onSimulationPaused(data) {
    console.log('[TrainingApp] Simulação pausada');
  }

  onSimulationResumed(data) {
    console.log('[TrainingApp] Simulação retomada');
  }

  onSimulationStopped(data) {
    console.log('[TrainingApp] Simulação encerrada:', data);
    
    // Atualizar métricas
    this.updateLatencyDisplay(data.metrics?.avgLatency || 0);
  }

  addChatMessage(message, type) {
    const chatContainer = document.getElementById('simChatMessages');
    if (!chatContainer) return;

    // Remover mensagem de empty se existir
    const emptyMsg = chatContainer.querySelector('.chat-empty');
    if (emptyMsg) emptyMsg.remove();

    // FIX HIGH XSS: message.id era interpolado direto em onclick e em msgEl.id.
    // Sanitiza para chars seguros e usa handlers delegados.
    const safeIdRaw = String(message.id || '');
    const safeId = safeIdRaw.replace(/[^A-Za-z0-9_\-]/g, '_').substring(0, 80);

    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${type}`;
    msgEl.id = `msg-${safeId}`;
    // Guardar id raw em dataset (atributo) — escape automático em set
    msgEl.dataset.messageId = safeIdRaw;

    let content = `<div class="message-content">${this.escapeHtml(message.content)}</div>`;

    // Se for mensagem do executor, adicionar botões de aprovação
    if (type === 'executor') {
      msgEl.classList.add('pending');
      content += `
        <div class="message-approval">
          <button class="btn-approve btn-approve-msg">✅ Aprovar</button>
          <button class="btn-reject btn-reject-msg">❌ Rejeitar</button>
        </div>
      `;
    }

    msgEl.innerHTML = content;

    // FIX: handlers delegados via closure em vez de onclick string
    if (type === 'executor') {
      const approveBtn = msgEl.querySelector('.btn-approve-msg');
      const rejectBtn = msgEl.querySelector('.btn-reject-msg');
      if (approveBtn) approveBtn.addEventListener('click', () => this.approveMessage(safeIdRaw));
      if (rejectBtn) rejectBtn.addEventListener('click', () => this.rejectMessage(safeIdRaw));
    }

    chatContainer.appendChild(msgEl);

    // Scroll para baixo
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Atualizar latência
    if (message.latency) {
      this.updateLatencyDisplay(message.latency);
    }
  }

  updateLatencyDisplay(latency) {
    const latencyEl = document.querySelector('.latency-value');
    if (latencyEl) {
      latencyEl.textContent = `${Math.round(latency)}MS`;
    }
  }

  clearChat() {
    const chatContainer = document.getElementById('simChatMessages');
    if (!chatContainer) return;

    chatContainer.innerHTML = `
      <div class="chat-empty">
        <span>🚀</span>
        <p>Selecione um tema e inicie a simulação</p>
      </div>
    `;

    // Limpar curadoria
    const curationList = document.getElementById('curationList');
    if (curationList) curationList.innerHTML = '';
  }

  approveMessage(messageId) {
    if (!this.simulation) return;

    this.simulation.approve(messageId);
    this.showToast('Resposta aprovada!', 'success');
  }

  rejectMessage(messageId) {
    if (!this.simulation) return;

    const reason = prompt('Motivo da rejeição (opcional):');
    this.simulation.reject(messageId, reason || '');
    this.showToast('Resposta rejeitada', 'info');
  }

  updateMessageStatus(messageId, status) {
    const msgEl = document.getElementById(`msg-${messageId}`);
    if (!msgEl) return;

    msgEl.classList.remove('pending', 'approved', 'rejected');
    msgEl.classList.add(status);

    // Remover botões de aprovação
    const approvalDiv = msgEl.querySelector('.message-approval');
    if (approvalDiv) {
      approvalDiv.innerHTML = status === 'approved' 
        ? '<span style="color: var(--success);">✅ Aprovada</span>'
        : '<span style="color: var(--danger);">❌ Rejeitada</span>';
    }
  }

  updateCurationSection() {
    if (!this.simulation) return;

    const state = this.simulation.getState();
    
    // Atualizar botão de salvar
    const btnSave = document.getElementById('btnSaveApproved');
    if (btnSave) {
      btnSave.disabled = state.approvedResponses.length === 0;
    }

    this.updateCurationStats();
  }

  updateCurationStats() {
    if (!this.simulation) return;

    const state = this.simulation.getState();
    
    const approvedEl = document.getElementById('approvedCount');
    const rejectedEl = document.getElementById('rejectedCount');
    
    if (approvedEl) approvedEl.textContent = state.approvedResponses?.length || 0;
    if (rejectedEl) rejectedEl.textContent = state.rejectedResponses?.length || 0;
  }

  async saveApprovedResponses() {
    if (!this.simulation) return;

    try {
      const result = await this.simulation.saveForLearning();
      this.showToast(result.message, result.saved > 0 ? 'success' : 'warning');
      
      // Atualizar stats
      this.updateStats();
      
    } catch (error) {
      console.error('[TrainingApp] Erro ao salvar:', error);
      this.showToast('Erro ao salvar respostas', 'error');
    }
  }

  connectExecutor() {
    this.showToast('Executor conectado ao cérebro AI', 'success');
    const statusEl = document.getElementById('executorStatus');
    if (statusEl) statusEl.textContent = 'Conectado';
  }

  connectSimulator() {
    this.showToast('Simulador conectado', 'success');
    const statusEl = document.getElementById('simulatorStatus');
    if (statusEl) statusEl.textContent = 'Conectado';
  }

  async runQuickTest() {
    const input = document.getElementById('quickTestInput');
    const resultDiv = document.getElementById('quickTestResult');
    const contentDiv = document.getElementById('quickTestContent');

    if (!input || !resultDiv || !contentDiv) return;

    const question = input.value.trim();
    if (!question) {
      this.showToast('Digite uma pergunta para testar', 'warning');
      return;
    }

    contentDiv.innerHTML = '<span style="color: var(--text-muted);">Processando...</span>';
    resultDiv.style.display = 'block';

    try {
      // Usar CopilotEngine se disponível
      if (window.CopilotEngine) {
        // Existem 2 contratos possíveis:
        // - CopilotEngine real (WhatsApp Web): generateResponse(chatId, analysis, options?)
        // - TrainingAIClient (training/modules/ai-client.js): generateResponse({ messages, lastMessage, temperature })
        let out = '';

        const gen = window.CopilotEngine.generateResponse;
        if (typeof gen === 'function' && gen.length <= 1) {
          // TrainingAIClient compat
          const resp = await gen({ messages: [], lastMessage: question, temperature: 0.7 });
          out = resp?.text || resp?.content || (typeof resp === 'string' ? resp : '');
        } else {
          // CopilotEngine completo
          const analysis = {
            originalMessage: question,
            intent: { id: 'test', confidence: 0.9 },
            sentiment: { score: 0, label: 'neutral' },
            entities: []
          };
          const resp = await gen('quick_test', analysis);
          out = resp?.content || resp?.text || (typeof resp === 'string' ? resp : '');
        }

        contentDiv.textContent = out || 'Sem resposta';
      } else if (window.AIService) {
        // Fallback: AIService direto
        let out = '';
        const complete = window.AIService.complete;
        if (typeof complete === 'function' && complete.length <= 1) {
          // TrainingAIClient compat: complete({ messages, lastMessage })
          const resp = await complete({ messages: [], lastMessage: question, temperature: 0.7 });
          out = resp?.text || resp?.content || (typeof resp === 'string' ? resp : '');
        } else {
          // AIService real: complete(messagesArray, options)
          const resp = await complete([
            { role: 'system', content: 'Você é um assistente prestativo. Responda de forma clara e profissional.' },
            { role: 'user', content: question }
          ], { temperature: 0.7 });
          out = resp?.content || resp?.text || (typeof resp === 'string' ? resp : '');
        }
        contentDiv.textContent = out || 'Sem resposta';
      } else {
        contentDiv.innerHTML = '<span style="color: var(--danger);">Serviço de IA temporariamente indisponível. Verifique sua conexão e tente novamente.</span>';
      }
    } catch (error) {
      console.error('[TrainingApp] Erro no teste rápido:', error);
      contentDiv.innerHTML = `<span style="color: var(--danger);">Erro: ${this.escapeHtml(error.message)}</span>`;
    }
  }

  // ============================================
  // IMPORT TAB METHODS
  // ============================================

  renderImportTab() {
    // Atualizar estatísticas de exportação
    const countEl = document.getElementById('exportExamplesCount');
    if (countEl) {
      countEl.textContent = this.examples.length;
    }
  }

  async handleFileUpload(files) {
    if (!files || files.length === 0) return;

    const queue = document.getElementById('uploadQueue');
    const resultsDiv = document.getElementById('importResults');
    const resultsGrid = document.getElementById('resultsGrid');

    for (const file of files) {
      // Mostrar na fila
      if (queue) {
        const safeFileName = this.escapeHtml(file.name);
        queue.innerHTML += `
          <div class="upload-item" id="upload-${file.name.replace(/\W/g, '_')}">
            <div class="upload-item-info">
              <span class="upload-item-icon">📄</span>
              <div>
                <div class="upload-item-name">${safeFileName}</div>
                <div class="upload-item-size">${(file.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
            <span class="upload-item-status">⏳</span>
          </div>
        `;
      }

      try {
        // Processar com DocumentImporter
        if (window.documentImporter) {
          const result = await window.documentImporter.processFile(file);
          
          // Atualizar status
          const itemEl = document.getElementById(`upload-${file.name.replace(/\W/g, '_')}`);
          if (itemEl) {
            itemEl.querySelector('.upload-item-status').textContent = '✅';
          }

          // Importar dados baseado no tipo
          if (result.type === 'products' && result.items.length > 0) {
            this.products.push(...result.items);
            await this.saveKnowledgeBase();
            this.showToast(`${result.items.length} produtos importados!`, 'success');
          } else if (result.type === 'faqs' && result.items.length > 0) {
            this.faqs.push(...result.items);
            await this.saveKnowledgeBase();
            this.showToast(`${result.items.length} FAQs importadas!`, 'success');
          } else if (result.type === 'examples' && result.items.length > 0) {
            this.examples.push(...result.items);
            await this.saveExamples();
            this.showToast(`${result.items.length} exemplos importados!`, 'success');
          }

          // Mostrar resultados
          if (resultsDiv && resultsGrid) {
            resultsDiv.style.display = 'block';
            const safeFileName = this.escapeHtml(file.name);
            resultsGrid.innerHTML += `
              <div class="result-card">
                <h4>${safeFileName}</h4>
                <p>Tipo: ${result.type} | Itens: ${result.count}</p>
              </div>
            `;
          }
        }
      } catch (error) {
        console.error('[TrainingApp] Erro ao processar arquivo:', error);
        const itemEl = document.getElementById(`upload-${file.name.replace(/\W/g, '_')}`);
        if (itemEl) {
          itemEl.querySelector('.upload-item-status').textContent = '❌';
        }
        this.showToast(`Erro ao processar ${file.name}`, 'error');
      }
    }

    this.updateStats();
    this.renderAll();
  }

  async handleWhatsAppImport(file) {
    if (!file) return;

    const attendantNames = document.getElementById('attendantNames')?.value || '';
    const names = attendantNames.split(',').map(n => n.trim()).filter(n => n);

    try {
      if (window.conversationAnalyzer) {
        const result = await window.conversationAnalyzer.importWhatsAppExport(file);
        this.showToast(`Conversa importada: ${result.messageCount} mensagens`, 'success');

        // Analisar conversa
        const analysis = window.conversationAnalyzer.analyzeConversation(result.conversationId, names);
        
        if (analysis && analysis.extractedExamples > 0) {
          // Adicionar exemplos de alta qualidade
          const highQuality = analysis.examples.filter(ex => ex.quality >= 7);
          window.conversationAnalyzer.addLearnedExamples(highQuality);
          
          this.showToast(`${highQuality.length} exemplos de alta qualidade extraídos!`, 'success');
          
          // Perguntar se quer adicionar ao treinamento
          if (confirm(`Deseja adicionar ${highQuality.length} exemplos ao treinamento?`)) {
            this.examples.push(...highQuality.map(ex => ({
              id: ex.id,
              input: ex.input,
              output: ex.output,
              category: ex.category,
              quality: ex.quality,
              intent: ex.intent,
              tags: ['imported', 'whatsapp'],
              source: 'conversation_import'
            })));
            await this.saveExamples();
            this.renderExamples();
            this.updateStats();
          }
        }
      }
    } catch (error) {
      console.error('[TrainingApp] Erro ao importar WhatsApp:', error);
      this.showToast('Erro ao importar conversa', 'error');
    }
  }

  async connectGoogleSheets() {
    const spreadsheetId = document.getElementById('sheetsId')?.value;
    const apiKey = document.getElementById('sheetsApiKey')?.value;
    const sheetsNames = document.getElementById('sheetsNames')?.value || '';

    if (!spreadsheetId || !apiKey) {
      this.showToast('Preencha todos os campos', 'warning');
      return;
    }

    try {
      if (window.externalKB) {
        window.externalKB.configureGoogleSheets({
          spreadsheetId,
          apiKey,
          sheets: sheetsNames.split(',').map(s => s.trim()).filter(s => s)
        });
        
        this.showToast('Google Sheets conectado!', 'success');
        this.closeModal('sheetsModal');
      }
    } catch (error) {
      console.error('[TrainingApp] Erro ao conectar Sheets:', error);
      this.showToast('Erro ao conectar', 'error');
    }
  }

  async connectNotion() {
    const apiKey = document.getElementById('notionApiKey')?.value;
    const databases = document.getElementById('notionDatabases')?.value || '';

    if (!apiKey) {
      this.showToast('Preencha a API Key', 'warning');
      return;
    }

    try {
      if (window.externalKB) {
        window.externalKB.configureNotion({
          apiKey,
          databases: databases.split(',').map(d => d.trim()).filter(d => d)
        });
        
        this.showToast('Notion conectado!', 'success');
        this.closeModal('notionModal');
      }
    } catch (error) {
      console.error('[TrainingApp] Erro ao conectar Notion:', error);
      this.showToast('Erro ao conectar', 'error');
    }
  }

  async exportToFormat(format) {
    if (!format) return;

    try {
      if (window.datasetExporter) {
        const result = await window.datasetExporter.download(format, {
          includeExamples: true,
          includeFaqs: true,
          minQuality: 6
        });
        
        this.showToast(`Exportado ${result.count} itens para ${format.toUpperCase()}`, 'success');
      }
    } catch (error) {
      console.error('[TrainingApp] Erro ao exportar:', error);
      this.showToast(`Erro ao exportar: ${error.message}`, 'error');
    }
  }

  // ============================================
  // GAP DETECTOR METHODS
  // ============================================

  renderGapsTab() {
    if (!window.gapDetector) {
      console.warn('[TrainingApp] GapDetector não disponível');
      return;
    }

    const stats = window.gapDetector.getStats();
    
    // Atualizar estatísticas
    const lowConfEl = document.getElementById('gapLowConfidence');
    const unansEl = document.getElementById('gapUnanswered');
    const clustersEl = document.getElementById('gapClusters');
    const avgConfEl = document.getElementById('gapAvgConfidence');
    
    if (lowConfEl) lowConfEl.textContent = stats.lowConfidenceCount;
    if (unansEl) unansEl.textContent = stats.unansweredCount;
    if (clustersEl) clustersEl.textContent = stats.clustersCount;
    if (avgConfEl) avgConfEl.textContent = `${Math.round(stats.avgConfidence * 100)}%`;

    // Renderizar sugestões
    const suggestionsEl = document.getElementById('gapSuggestions');
    if (suggestionsEl) {
      const suggestions = window.gapDetector.generateSuggestions();
      
      if (suggestions.length === 0) {
        suggestionsEl.innerHTML = `
          <div class="suggestion-item">
            <span class="suggestion-icon">✅</span>
            <div class="suggestion-content">
              <div class="suggestion-title">Nenhuma lacuna detectada!</div>
              <div class="suggestion-description">Sua base de conhecimento está bem completa.</div>
            </div>
          </div>
        `;
      } else {
        const allowedPriorities = ['high', 'medium', 'low'];
        suggestionsEl.innerHTML = suggestions.slice(0, 5).map(s => `
          <div class="suggestion-item ${allowedPriorities.includes(s.priority) ? s.priority : 'medium'}">
            <span class="suggestion-icon">${s.type === 'cluster' ? '📊' : s.type === 'unanswered' ? '❓' : '📁'}</span>
            <div class="suggestion-content">
              <div class="suggestion-title">${this.escapeHtml(s.title)}</div>
              <div class="suggestion-description">${this.escapeHtml(s.description)}</div>
              <div class="suggestion-action">
                <button class="btn btn-small btn-primary" data-sugg-type="${encodeURIComponent(String(s.type || ''))}" data-sugg-action="${encodeURIComponent(String(s.action || ''))}">
                  ${s.action === 'add_examples' ? 'Adicionar Exemplos' : 
                    s.action === 'add_faq' ? 'Criar FAQ' : 'Revisar'}
                </button>
              </div>
            </div>
          </div>
        `).join('');

        // Bind (evitar inline onclick)
        suggestionsEl.querySelectorAll('button[data-sugg-type][data-sugg-action]').forEach(btn => {
          btn.addEventListener('click', () => {
            let type = '';
            let action = '';
            try { type = decodeURIComponent(btn.dataset.suggType || ''); } catch (_) { type = btn.dataset.suggType || ''; }
            try { action = decodeURIComponent(btn.dataset.suggAction || ''); } catch (_) { action = btn.dataset.suggAction || ''; }
            this.handleSuggestionAction(type, action);
          });
        });
      }
    }

    // Renderizar perguntas não respondidas
    const unansweredEl = document.getElementById('unansweredList');
    if (unansweredEl) {
      const topUnanswered = window.gapDetector.getTopUnanswered(10);
      
      if (topUnanswered.length === 0) {
        unansweredEl.innerHTML = '<p style="color: var(--text-muted);">Nenhuma pergunta sem resposta detectada.</p>';
      } else {
        unansweredEl.innerHTML = topUnanswered.map(u => `
          <div class="unanswered-item">
            <span class="unanswered-question">${this.escapeHtml(u.question).substring(0, 100)}...</span>
            <span class="unanswered-count">${u.occurrences}x</span>
          </div>
        `).join('');
      }
    }

    // Renderizar distribuição por categoria
    const categoryGapsEl = document.getElementById('categoryGaps');
    if (categoryGapsEl) {
      const distribution = window.gapDetector.getGapsByCategory();
      
      categoryGapsEl.innerHTML = Object.entries(distribution).map(([category, data]) => `
        <div class="category-gap-card">
          <div class="category-gap-name">${category}</div>
          <div class="category-gap-bar">
            <div class="category-gap-fill" style="width: ${Math.min(100, data.count * 10)}%"></div>
          </div>
          <div class="category-gap-stats">${data.count} gaps | Confiança: ${Math.round(data.avgConfidence * 100)}%</div>
        </div>
      `).join('');
    }
  }

  handleSuggestionAction(type, action) {
    if (action === 'add_examples') {
      this.switchTab('examples');
      this.openExampleModal();
    } else if (action === 'add_faq') {
      this.switchTab('faqs');
      this.openFaqModal();
    }
  }

  // ============================================
  // A/B TESTING METHODS
  // ============================================

  renderAbTestingTab() {
    const grid = document.getElementById('abTestsGrid');
    const empty = document.getElementById('emptyTests');
    
    if (!grid || !window.abTesting) return;

    const tests = window.abTesting.getAllTests();

    if (tests.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }

    if (empty) empty.style.display = 'none';

    grid.innerHTML = tests.map(test => {
      const metrics = window.abTesting.getTestMetrics(test.id);
      
      return `
        <div class="ab-test-card" data-id="${test.id}">
          <div class="ab-test-header">
            <span class="ab-test-name">${test.name}</span>
            <span class="ab-test-status ${test.status}">${
              test.status === 'draft' ? '📝 Rascunho' :
              test.status === 'running' ? '🟢 Ativo' : '✅ Concluído'
            }</span>
          </div>
          <div class="ab-test-question">"${this.escapeHtml(test.question)}"</div>
          <div class="ab-variations">
            ${test.variations.map(v => `
              <div class="ab-variation ${test.winner?.variationId === v.id ? 'winner' : ''}">
                <div class="ab-variation-header">
                  <span class="ab-variation-label">${v.label}</span>
                  ${test.winner?.variationId === v.id ? '<span class="ab-variation-badge">VENCEDOR</span>' : ''}
                </div>
                <div class="ab-variation-text">${this.escapeHtml(v.response).substring(0, 100)}...</div>
                <div class="ab-variation-metrics">
                  <span class="ab-metric">👁️ ${v.impressions}</span>
                  <span class="ab-metric">✅ ${((v.accepted / Math.max(1, v.impressions)) * 100).toFixed(0)}%</span>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="ab-test-actions">
            ${test.status === 'draft' ? 
              `<button class="btn btn-small btn-success" onclick="app.startAbTest('${test.id}')">▶️ Iniciar</button>` : ''}
            ${test.status === 'running' ? 
              `<button class="btn btn-small btn-warning" onclick="app.stopAbTest('${test.id}')">⏹️ Parar</button>` : ''}
            ${test.status === 'completed' && test.winner?.determined ? 
              `<button class="btn btn-small btn-primary" onclick="app.promoteAbWinner('${test.id}')">🏆 Promover</button>` : ''}
            <button class="btn btn-small btn-secondary" onclick="app.deleteAbTest('${test.id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  createAbTest() {
    const name = document.getElementById('abTestName')?.value;
    const question = document.getElementById('abTestQuestion')?.value;
    const varA = document.getElementById('abVariationA')?.value;
    const varB = document.getElementById('abVariationB')?.value;
    const varC = document.getElementById('abVariationC')?.value;

    if (!name || !question || !varA || !varB) {
      this.showToast('Preencha nome, pergunta e ao menos 2 variações', 'warning');
      return;
    }

    const variations = [
      { label: 'Variação A', response: varA },
      { label: 'Variação B', response: varB }
    ];

    if (varC && varC.trim()) {
      variations.push({ label: 'Variação C', response: varC });
    }

    try {
      if (window.abTesting) {
        window.abTesting.createTest({ name, question, variations });
        this.showToast('Teste A/B criado!', 'success');
        this.closeModal('abTestModal');
        this.renderAbTestingTab();
        
        // Limpar form
        document.getElementById('abTestName').value = '';
        document.getElementById('abTestQuestion').value = '';
        document.getElementById('abVariationA').value = '';
        document.getElementById('abVariationB').value = '';
        document.getElementById('abVariationC').value = '';
      }
    } catch (error) {
      console.error('[TrainingApp] Erro ao criar teste:', error);
      this.showToast('Erro ao criar teste', 'error');
    }
  }

  startAbTest(testId) {
    if (window.abTesting) {
      window.abTesting.startTest(testId);
      this.showToast('Teste iniciado!', 'success');
      this.renderAbTestingTab();
    }
  }

  stopAbTest(testId) {
    if (window.abTesting) {
      window.abTesting.stopTest(testId);
      this.showToast('Teste finalizado!', 'success');
      this.renderAbTestingTab();
    }
  }

  async promoteAbWinner(testId) {
    if (window.abTesting) {
      const result = await window.abTesting.promoteWinner(testId);
      if (result.success) {
        this.showToast(result.message, 'success');
        await this.loadAllData();
        this.renderAll();
      } else {
        this.showToast(result.reason, 'warning');
      }
    }
  }

  deleteAbTest(testId) {
    if (confirm('Excluir este teste A/B?')) {
      if (window.abTesting) {
        window.abTesting.deleteTest(testId);
        this.showToast('Teste excluído', 'success');
        this.renderAbTestingTab();
      }
    }
  }

  // ============================================
  // ANALYTICS ENHANCEMENTS
  // ============================================

  renderCategoryScores() {
    const container = document.getElementById('categoryScores');
    if (!container || !window.qualityScorer) return;

    const scores = window.qualityScorer.getAllCategoryScores();
    
    if (scores.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">Nenhum dado de categoria ainda.</p>';
      return;
    }

    container.innerHTML = scores.map(s => `
      <div class="category-score-card ${s.level}">
        <div class="category-score-name">${s.category}</div>
        <div class="category-score-value">${Math.round(s.score * 100)}%</div>
        <div class="category-score-trend ${s.trend}">
          ${s.trend === 'improving' ? '📈 Melhorando' : 
            s.trend === 'declining' ? '📉 Caindo' : '➡️ Estável'}
        </div>
      </div>
    `).join('');
  }

  renderSentimentMetrics() {
    if (!window.sentimentTracker) return;

    const metrics = window.sentimentTracker.getGlobalMetrics();
    const distribution = window.sentimentTracker.getSentimentDistribution();

    // Atualizar barras
    const positiveBar = document.getElementById('sentimentPositive');
    const neutralBar = document.getElementById('sentimentNeutral');
    const negativeBar = document.getElementById('sentimentNegative');
    
    if (positiveBar) positiveBar.style.width = `${distribution.positive * 100}%`;
    if (neutralBar) neutralBar.style.width = `${distribution.neutral * 100}%`;
    if (negativeBar) negativeBar.style.width = `${distribution.negative * 100}%`;

    // Atualizar labels
    const positiveVal = document.getElementById('sentimentPositiveVal');
    const neutralVal = document.getElementById('sentimentNeutralVal');
    const negativeVal = document.getElementById('sentimentNegativeVal');
    
    if (positiveVal) positiveVal.textContent = `${Math.round(distribution.positive * 100)}%`;
    if (neutralVal) neutralVal.textContent = `${Math.round(distribution.neutral * 100)}%`;
    if (negativeVal) negativeVal.textContent = `${Math.round(distribution.negative * 100)}%`;
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }
}

// Inicializar app
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new TrainingApp();
});
