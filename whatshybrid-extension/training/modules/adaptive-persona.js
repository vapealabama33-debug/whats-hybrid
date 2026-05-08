/**
 * 🎭 Adaptive Persona - Personas Adaptativas
 * Ajusta tom e estilo da IA baseado no perfil do cliente
 * 
 * @version 1.0.0
 */

class AdaptivePersona {
  constructor() {
    this.clientProfiles = new Map();
    this.personaTemplates = this.initializeTemplates();
    this.adaptationHistory = [];
  }

  // ============================================
  // TEMPLATES DE PERSONA
  // ============================================

  initializeTemplates() {
    return {
      premium: {
        id: 'premium',
        name: '🌟 Cliente Premium',
        description: 'Cliente de alto valor, tratamento VIP',
        tone: 'formal_warm',
        responseLength: 'detailed',
        features: {
          useTitle: true,
          prioritySupport: true,
          proactiveOffers: true,
          exclusiveInfo: true
        },
        systemPrompt: `Trate este cliente como VIP. Use linguagem respeitosa e atenciosa.
- Use título (Sr./Sra.) quando souber o nome
- Ofereça atendimento prioritário
- Mencione benefícios exclusivos
- Seja proativo em oferecer ajuda adicional`
      },
      
      tecnico: {
        id: 'tecnico',
        name: '🔧 Cliente Técnico',
        description: 'Cliente com conhecimento técnico',
        tone: 'technical',
        responseLength: 'detailed',
        features: {
          useJargon: true,
          detailedSpecs: true,
          skipBasics: true,
          directAnswers: true
        },
        systemPrompt: `Este cliente tem conhecimento técnico.
- Use termos técnicos apropriados
- Forneça especificações detalhadas
- Pule explicações básicas
- Seja direto e objetivo`
      },
      
      iniciante: {
        id: 'iniciante',
        name: '🌱 Cliente Iniciante',
        description: 'Cliente que precisa de explicações simples',
        tone: 'friendly_educational',
        responseLength: 'moderate',
        features: {
          simpleLanguage: true,
          stepByStep: true,
          analogies: true,
          reassurance: true
        },
        systemPrompt: `Este cliente é iniciante e precisa de explicações simples.
- Use linguagem clara e acessível
- Explique passo a passo quando necessário
- Use analogias para conceitos complexos
- Ofereça reasseguramento e suporte`
      },
      
      apressado: {
        id: 'apressado',
        name: '⚡ Cliente Apressado',
        description: 'Cliente com urgência, respostas diretas',
        tone: 'direct',
        responseLength: 'concise',
        features: {
          bulletPoints: true,
          skipSmallTalk: true,
          quickActions: true,
          urgencyAwareness: true
        },
        systemPrompt: `Este cliente está com pressa.
- Seja direto e objetivo
- Use bullet points quando possível
- Evite conversa desnecessária
- Ofereça soluções rápidas`
      },
      
      indeciso: {
        id: 'indeciso',
        name: '🤔 Cliente Indeciso',
        description: 'Cliente que precisa de orientação',
        tone: 'consultative',
        responseLength: 'moderate',
        features: {
          comparisons: true,
          recommendations: true,
          testimonials: true,
          noUrgency: true
        },
        systemPrompt: `Este cliente está indeciso e precisa de orientação.
- Faça perguntas para entender necessidades
- Ofereça comparações entre opções
- Dê recomendações baseadas no perfil
- Não pressione, deixe-o confortável`
      },
      
      reclamante: {
        id: 'reclamante',
        name: '😤 Cliente Insatisfeito',
        description: 'Cliente com reclamação ou problema',
        tone: 'empathetic_solution',
        responseLength: 'moderate',
        features: {
          empathy: true,
          acknowledgment: true,
          solutionFocus: true,
          escalationReady: true
        },
        systemPrompt: `Este cliente está insatisfeito.
- Demonstre empatia genuína
- Reconheça o problema
- Foque em soluções
- Ofereça compensação se apropriado
- Esteja pronto para escalar se necessário`
      },
      
      fiel: {
        id: 'fiel',
        name: '💎 Cliente Fiel',
        description: 'Cliente de longo prazo',
        tone: 'friendly_personal',
        responseLength: 'moderate',
        features: {
          useHistory: true,
          loyaltyBenefits: true,
          personalTouch: true,
          gratitude: true
        },
        systemPrompt: `Este é um cliente fiel de longo prazo.
- Use histórico de interações se disponível
- Mencione benefícios de fidelidade
- Seja pessoal e próximo
- Demonstre gratidão pela preferência`
      },
      
      default: {
        id: 'default',
        name: '👤 Cliente Padrão',
        description: 'Perfil padrão equilibrado',
        tone: 'professional_friendly',
        responseLength: 'moderate',
        features: {
          balanced: true
        },
        systemPrompt: `Use tom profissional mas amigável.
- Seja educado e prestativo
- Responda de forma clara
- Ofereça ajuda adicional`
      }
    };
  }

  // ============================================
  // DETECÇÃO DE PERFIL
  // ============================================

  /**
   * Detecta perfil do cliente baseado em sinais
   */
  detectProfile(signals) {
    const {
      messageHistory = [],
      purchaseHistory = [],
      totalSpent = 0,
      accountAge = 0,
      currentMessage = '',
      responseTime = null,
      previousInteractions = 0
    } = signals;

    const scores = {};
    
    // Inicializar scores
    Object.keys(this.personaTemplates).forEach(key => {
      scores[key] = 0;
    });

    // Análise de valor do cliente
    if (totalSpent > 1000 || purchaseHistory.length > 5) {
      scores.premium += 3;
      scores.fiel += 2;
    }

    // Análise de tempo de conta
    if (accountAge > 365) {
      scores.fiel += 2;
    }

    // Análise da mensagem atual
    const msgLower = currentMessage.toLowerCase();
    
    // Detectar urgência
    if (/urgente|rápido|agora|preciso já|imediato/i.test(msgLower)) {
      scores.apressado += 3;
    }

    // Detectar conhecimento técnico
    if (/api|sdk|endpoint|config|debug|log|servidor|database/i.test(msgLower)) {
      scores.tecnico += 3;
    }

    // Detectar insatisfação
    if (/problema|reclamação|péssimo|horrível|nunca mais|decepcionado/i.test(msgLower)) {
      scores.reclamante += 4;
    }

    // Detectar indecisão
    if (/não sei|qual melhor|dúvida|comparar|diferença entre/i.test(msgLower)) {
      scores.indeciso += 3;
    }

    // Detectar iniciante
    if (/como funciona|não entendi|pode explicar|o que é/i.test(msgLower)) {
      scores.iniciante += 2;
    }

    // Análise do histórico de mensagens
    if (messageHistory.length > 0) {
      const avgLength = messageHistory.reduce((sum, m) => sum + m.length, 0) / messageHistory.length;
      
      // Mensagens curtas = apressado
      if (avgLength < 30) {
        scores.apressado += 1;
      }
      
      // Mensagens longas e detalhadas = técnico ou indeciso
      if (avgLength > 100) {
        scores.tecnico += 1;
        scores.indeciso += 1;
      }
    }

    // Tempo de resposta
    if (responseTime !== null) {
      if (responseTime < 1000) { // Responde muito rápido
        scores.apressado += 1;
      }
    }

    // Encontrar perfil com maior score
    let maxScore = 0;
    let detectedProfile = 'default';

    Object.entries(scores).forEach(([profile, score]) => {
      if (score > maxScore && profile !== 'default') {
        maxScore = score;
        detectedProfile = profile;
      }
    });

    // Se score muito baixo, usar default
    if (maxScore < 2) {
      detectedProfile = 'default';
    }

    return {
      profileId: detectedProfile,
      profile: this.personaTemplates[detectedProfile],
      confidence: Math.min(1, maxScore / 5),
      scores
    };
  }

  // ============================================
  // ADAPTAÇÃO
  // ============================================

  /**
   * Obtém persona adaptada para um chat
   */
  getAdaptedPersona(chatId, signals = {}) {
    // Verificar se já tem perfil detectado
    let clientProfile = this.clientProfiles.get(chatId);

    if (!clientProfile || this.shouldRedetect(clientProfile)) {
      const detection = this.detectProfile(signals);
      
      clientProfile = {
        chatId,
        ...detection,
        detectedAt: Date.now(),
        interactions: 0,
        adaptations: []
      };

      this.clientProfiles.set(chatId, clientProfile);
    }

    // Incrementar interações
    clientProfile.interactions++;

    return this.buildPersonaPrompt(clientProfile);
  }

  /**
   * Verifica se deve re-detectar perfil
   */
  shouldRedetect(profile) {
    // Re-detectar a cada 10 interações ou se muito antigo
    return profile.interactions > 10 || 
           (Date.now() - profile.detectedAt) > 30 * 60 * 1000; // 30 min
  }

  /**
   * Constrói prompt de persona
   */
  buildPersonaPrompt(clientProfile) {
    const template = clientProfile.profile;
    
    let prompt = template.systemPrompt;

    // Adicionar ajustes baseados em features
    const features = template.features || {};

    if (features.useTitle && clientProfile.clientName) {
      prompt += `\nUse o nome do cliente: ${clientProfile.clientName}`;
    }

    if (features.useHistory && clientProfile.purchaseHistory?.length > 0) {
      prompt += `\nHistórico de compras disponível para referência.`;
    }

    return {
      profileId: template.id,
      profileName: template.name,
      tone: template.tone,
      responseLength: template.responseLength,
      systemPrompt: prompt,
      confidence: clientProfile.confidence
    };
  }

  /**
   * Atualiza perfil baseado em feedback
   */
  updateProfile(chatId, feedback) {
    const profile = this.clientProfiles.get(chatId);
    if (!profile) return;

    profile.adaptations.push({
      feedback,
      timestamp: Date.now()
    });

    // Ajustar baseado em feedback negativo
    if (feedback.type === 'negative' && feedback.reason) {
      // Se cliente reclamou de tom muito formal, ajustar
      if (/formal|frio|distante/i.test(feedback.reason)) {
        profile.profile = this.personaTemplates.default;
        profile.profile.tone = 'friendly_casual';
      }
      
      // Se cliente reclamou de resposta longa, ajustar
      if (/longo|muito texto|resumo/i.test(feedback.reason)) {
        profile.profile.responseLength = 'concise';
      }
    }

    this.adaptationHistory.push({
      chatId,
      feedback,
      newProfile: profile.profile.id,
      timestamp: Date.now()
    });
  }

  // ============================================
  // UTILS
  // ============================================

  /**
   * Obtém estatísticas de perfis
   */
  getStats() {
    const distribution = {};
    
    this.clientProfiles.forEach(profile => {
      const id = profile.profileId;
      distribution[id] = (distribution[id] || 0) + 1;
    });

    return {
      totalClients: this.clientProfiles.size,
      distribution,
      totalAdaptations: this.adaptationHistory.length
    };
  }

  /**
   * Limpa perfis antigos
   */
  cleanup(maxAge = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAge;
    
    this.clientProfiles.forEach((profile, chatId) => {
      if (profile.detectedAt < cutoff) {
        this.clientProfiles.delete(chatId);
      }
    });
  }

  /**
   * Obtém todos os templates disponíveis
   */
  getTemplates() {
    return Object.values(this.personaTemplates);
  }

  /**
   * Adiciona template customizado
   */
  addTemplate(template) {
    if (!template.id || !template.systemPrompt) {
      throw new Error('Template precisa de id e systemPrompt');
    }
    this.personaTemplates[template.id] = template;
  }
}

// Exportar
window.AdaptivePersona = AdaptivePersona;
window.adaptivePersona = new AdaptivePersona();
console.log('[AdaptivePersona] ✅ Módulo de personas adaptativas carregado');
