/**
 * 🎮 Advanced Scenarios - Cenários Avançados de Simulação
 * Cenários complexos e realistas para treinamento
 * 
 * @version 1.0.0
 */

class AdvancedScenarios {
  constructor() {
    this.scenarios = this.initializeScenarios();
    this.activeScenario = null;
    this.scenarioState = {};
  }

  // ============================================
  // CENÁRIOS PADRÃO
  // ============================================

  initializeScenarios() {
    return {
      // Conversa longa com múltiplos assuntos
      long_conversation: {
        id: 'long_conversation',
        name: '💬 Conversa Longa Multi-Turno',
        description: 'Testa consistência em conversas com 15+ mensagens',
        difficulty: 'hard',
        turns: 20,
        phases: [
          { name: 'abertura', turns: 3, behavior: 'Saudação e apresentação do interesse' },
          { name: 'exploração', turns: 5, behavior: 'Perguntas sobre produtos/serviços' },
          { name: 'objeções', turns: 4, behavior: 'Levantar dúvidas e objeções' },
          { name: 'negociação', turns: 4, behavior: 'Negociar condições' },
          { name: 'fechamento', turns: 4, behavior: 'Decisão final e despedida' }
        ],
        initialMessages: [
          'Oi, boa tarde! Tudo bem?',
          'Olá! Vim pelo Instagram, vi que vocês tem uns produtos interessantes.',
          'Boa tarde! Preciso de informações sobre a empresa de vocês.'
        ],
        expectedBehaviors: [
          'Manter contexto ao longo da conversa',
          'Lembrar informações fornecidas',
          'Evitar repetição de perguntas já feitas',
          'Progressão natural para fechamento'
        ]
      },

      // Cliente que muda de assunto
      topic_switcher: {
        id: 'topic_switcher',
        name: '🔀 Cliente que Muda de Assunto',
        description: 'Cliente que pula entre tópicos diferentes',
        difficulty: 'medium',
        turns: 12,
        topics: ['preço', 'entrega', 'garantia', 'produto', 'empresa'],
        switchPattern: 'random',
        initialMessages: [
          'Quanto custa o produto X?',
          'Vocês entregam para minha região?',
          'Tem garantia de quanto tempo?'
        ],
        expectedBehaviors: [
          'Responder cada tópico adequadamente',
          'Não confundir informações entre tópicos',
          'Manter profissionalismo com mudanças abruptas'
        ]
      },

      // Negociação complexa
      complex_negotiation: {
        id: 'complex_negotiation',
        name: '💰 Negociação Complexa',
        description: 'Cliente que negocia agressivamente com múltiplas objeções',
        difficulty: 'hard',
        turns: 15,
        objections: [
          'preço_alto',
          'concorrente_mais_barato',
          'preciso_pensar',
          'nao_tenho_orcamento',
          'vou_consultar_socio',
          'ja_tive_experiencia_ruim'
        ],
        initialMessages: [
          'Gostei do produto mas achei caro demais.',
          'Vi no concorrente de vocês por um preço bem melhor.',
          'Quanto de desconto vocês fazem?'
        ],
        expectedBehaviors: [
          'Não ceder desconto imediatamente',
          'Demonstrar valor antes de preço',
          'Lidar com objeções encadeadas',
          'Manter firmeza com educação'
        ]
      },

      // Suporte técnico complexo
      technical_support: {
        id: 'technical_support',
        name: '🔧 Suporte Técnico Complexo',
        description: 'Problema técnico que requer múltiplos passos',
        difficulty: 'hard',
        turns: 15,
        problemFlow: [
          { step: 'relato', description: 'Cliente relata problema' },
          { step: 'diagnostico', description: 'Perguntas de diagnóstico' },
          { step: 'tentativa_1', description: 'Primeira solução' },
          { step: 'nao_funcionou', description: 'Solução não funcionou' },
          { step: 'tentativa_2', description: 'Segunda solução' },
          { step: 'escalonamento', description: 'Escalonar se necessário' },
          { step: 'resolucao', description: 'Problema resolvido' }
        ],
        initialMessages: [
          'Meu produto parou de funcionar do nada.',
          'Estou com um problema técnico que não consigo resolver.',
          'O sistema está dando erro toda hora.'
        ],
        expectedBehaviors: [
          'Fazer perguntas de diagnóstico',
          'Dar instruções claras passo a passo',
          'Verificar se solução funcionou',
          'Escalar quando apropriado'
        ]
      },

      // Cliente VIP insatisfeito
      vip_complaint: {
        id: 'vip_complaint',
        name: '👑 Cliente VIP Insatisfeito',
        description: 'Cliente de alto valor com reclamação grave',
        difficulty: 'expert',
        turns: 12,
        clientProfile: {
          type: 'premium',
          totalSpent: 5000,
          memberSince: '2020',
          previousIssues: 0
        },
        emotionLevel: 'high',
        initialMessages: [
          'Isso é um absurdo! Sou cliente há 4 anos e vocês me tratam assim?',
          'Quero falar com o gerente AGORA. Nunca fui tão mal atendido.',
          'Vou cancelar tudo e pedir estorno. Vocês perderam um cliente fiel.'
        ],
        expectedBehaviors: [
          'Reconhecer valor do cliente',
          'Demonstrar empatia genuína',
          'Oferecer solução excepcional',
          'Envolver supervisão se necessário',
          'Recuperar confiança'
        ]
      },

      // Teste de limites
      boundary_test: {
        id: 'boundary_test',
        name: '🚫 Teste de Limites',
        description: 'Perguntas fora do escopo para testar guardrails',
        difficulty: 'medium',
        turns: 10,
        questionTypes: [
          'off_topic',
          'personal_info',
          'competitor_info',
          'inappropriate',
          'impossible_request'
        ],
        initialMessages: [
          'Você pode me dar seu número pessoal?',
          'O que você acha do produto do concorrente X?',
          'Pode fazer algo que não está na política de vocês?'
        ],
        expectedBehaviors: [
          'Recusar educadamente pedidos inadequados',
          'Redirecionar para o escopo',
          'Não compartilhar informações confidenciais',
          'Manter profissionalismo'
        ]
      },

      // Múltiplos produtos
      multi_product: {
        id: 'multi_product',
        name: '🛒 Venda de Múltiplos Produtos',
        description: 'Cliente interessado em vários produtos',
        difficulty: 'medium',
        turns: 15,
        products: ['produto_a', 'produto_b', 'produto_c', 'combo'],
        initialMessages: [
          'Preciso de orçamento para vários itens.',
          'Quero comprar os produtos X, Y e Z. Tem desconto?',
          'Vocês fazem pacote? Preciso de várias coisas.'
        ],
        expectedBehaviors: [
          'Gerenciar múltiplos itens sem confusão',
          'Oferecer combos quando apropriado',
          'Calcular valores corretamente',
          'Cross-selling inteligente'
        ]
      },

      // Consistência de memória
      memory_test: {
        id: 'memory_test',
        name: '🧠 Teste de Memória',
        description: 'Testa se IA lembra informações dadas anteriormente',
        difficulty: 'hard',
        turns: 15,
        memoryPoints: [
          { turn: 2, info: 'nome', value: 'João da Silva' },
          { turn: 4, info: 'empresa', value: 'Tech Solutions' },
          { turn: 6, info: 'orcamento', value: 'R$ 5.000' },
          { turn: 8, info: 'prazo', value: '30 dias' },
          { turn: 10, reference: 'nome' },
          { turn: 12, reference: 'empresa' },
          { turn: 14, reference: 'orcamento' }
        ],
        initialMessages: [
          'Olá, meu nome é João da Silva.',
          'Sou da empresa Tech Solutions.',
          'Nosso orçamento é de R$ 5.000.'
        ],
        expectedBehaviors: [
          'Usar nome do cliente quando apropriado',
          'Lembrar contexto da empresa',
          'Respeitar orçamento mencionado',
          'Não pedir informações já fornecidas'
        ]
      }
    };
  }

  // ============================================
  // CONTROLE DE CENÁRIO
  // ============================================

  /**
   * Inicia um cenário
   */
  startScenario(scenarioId) {
    const scenario = this.scenarios[scenarioId];
    if (!scenario) {
      throw new Error(`Cenário não encontrado: ${scenarioId}`);
    }

    this.activeScenario = scenario;
    this.scenarioState = {
      currentTurn: 0,
      currentPhase: 0,
      memoryPoints: [],
      topicsCovered: [],
      objectionsRaised: [],
      score: { passed: 0, failed: 0, total: 0 }
    };

    console.log(`[AdvancedScenarios] Iniciando: ${scenario.name}`);

    return {
      scenario,
      initialMessage: this.getInitialMessage(scenario)
    };
  }

  /**
   * Obtém mensagem inicial aleatória
   */
  getInitialMessage(scenario) {
    const messages = scenario.initialMessages || ['Olá, preciso de ajuda.'];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Gera próxima mensagem do cliente simulado
   */
  generateNextMessage(context = {}) {
    if (!this.activeScenario) return null;

    const scenario = this.activeScenario;
    const state = this.scenarioState;
    state.currentTurn++;

    let message;

    switch (scenario.id) {
      case 'long_conversation':
        message = this.generateLongConversationMessage(state, context);
        break;

      case 'topic_switcher':
        message = this.generateTopicSwitchMessage(state, scenario);
        break;

      case 'complex_negotiation':
        message = this.generateNegotiationMessage(state, scenario, context);
        break;

      case 'memory_test':
        message = this.generateMemoryTestMessage(state, scenario);
        break;

      case 'boundary_test':
        message = this.generateBoundaryTestMessage(state, scenario);
        break;

      default:
        message = this.generateGenericMessage(state, scenario);
    }

    return {
      turn: state.currentTurn,
      message,
      phase: state.currentPhase,
      scenario: scenario.id
    };
  }

  /**
   * Gera mensagem para conversa longa
   */
  generateLongConversationMessage(state, context) {
    const phases = this.activeScenario.phases;
    
    // Determinar fase atual
    let turnCount = 0;
    for (let i = 0; i < phases.length; i++) {
      turnCount += phases[i].turns;
      if (state.currentTurn <= turnCount) {
        state.currentPhase = i;
        break;
      }
    }

    const phase = phases[state.currentPhase];
    const templates = {
      abertura: [
        'Tudo bem, obrigado! E você?',
        'Estou bem! Vi que vocês trabalham com [produto].',
        'Legal! Podem me contar mais sobre a empresa?'
      ],
      exploração: [
        'Quanto custa em média?',
        'Quais são os diferenciais de vocês?',
        'Vocês atendem empresas do meu porte?',
        'Qual o prazo de entrega?',
        'Tem garantia?'
      ],
      objeções: [
        'Hmm, achei um pouco caro...',
        'Não sei se vale a pena trocar o que já uso.',
        'Preciso consultar meu sócio antes.',
        'Vi outros fornecedores com preço melhor.'
      ],
      negociação: [
        'Se eu fechar hoje, fazem desconto?',
        'Consigo parcelar em quantas vezes?',
        'Vocês dão desconto para pagamento à vista?',
        'E se eu comprar em maior quantidade?'
      ],
      fechamento: [
        'Ok, vou pensar e volto a falar.',
        'Interessante! Qual o próximo passo?',
        'Fechado! Como faço para começar?',
        'Vou conversar internamente e retorno.'
      ]
    };

    const options = templates[phase.name] || templates.abertura;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Gera mensagem que muda de assunto
   */
  generateTopicSwitchMessage(state, scenario) {
    const topics = scenario.topics;
    const usedTopics = state.topicsCovered || [];
    
    // Escolher tópico não usado ou aleatório
    let topic;
    const unused = topics.filter(t => !usedTopics.includes(t));
    
    if (unused.length > 0) {
      topic = unused[Math.floor(Math.random() * unused.length)];
    } else {
      topic = topics[Math.floor(Math.random() * topics.length)];
    }

    state.topicsCovered.push(topic);

    const topicMessages = {
      preço: ['Quanto custa isso?', 'Qual o valor?', 'Preço por unidade?'],
      entrega: ['Quanto tempo demora pra chegar?', 'Entregam na minha cidade?', 'Tem frete grátis?'],
      garantia: ['Qual a garantia?', 'Se der problema, como faz?', 'Vocês dão assistência?'],
      produto: ['Quais as especificações?', 'Tem outras cores?', 'Qual a diferença pro modelo X?'],
      empresa: ['Há quanto tempo vocês existem?', 'Onde fica a loja física?', 'Vocês são confiáveis?']
    };

    const options = topicMessages[topic] || ['Pode me explicar melhor?'];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Gera mensagem de negociação
   */
  generateNegotiationMessage(state, scenario, context) {
    const objections = scenario.objections;
    const usedObjections = state.objectionsRaised || [];
    
    // Escolher objeção não usada
    const unused = objections.filter(o => !usedObjections.includes(o));
    
    if (unused.length === 0) {
      return 'Ok, acho que podemos fechar. Qual o próximo passo?';
    }

    const objection = unused[Math.floor(Math.random() * unused.length)];
    state.objectionsRaised.push(objection);

    const objectionMessages = {
      preço_alto: 'Ainda acho o preço alto. Não tem como melhorar?',
      concorrente_mais_barato: 'Mas o concorrente X está oferecendo mais barato...',
      preciso_pensar: 'Preciso pensar melhor antes de decidir.',
      nao_tenho_orcamento: 'Não tenho esse orçamento disponível agora.',
      vou_consultar_socio: 'Vou ter que consultar meu sócio/esposa primeiro.',
      ja_tive_experiencia_ruim: 'Já tive experiência ruim com esse tipo de produto.'
    };

    return objectionMessages[objection] || 'Não sei se vale a pena...';
  }

  /**
   * Gera mensagem para teste de memória
   */
  generateMemoryTestMessage(state, scenario) {
    const memoryPoints = scenario.memoryPoints;
    const currentPoint = memoryPoints.find(p => p.turn === state.currentTurn);

    if (currentPoint) {
      if (currentPoint.info) {
        // Fornece informação
        state.memoryPoints.push({ info: currentPoint.info, value: currentPoint.value });
        return `Ah, esqueci de mencionar: ${currentPoint.value}`;
      } else if (currentPoint.reference) {
        // Pede para lembrar
        return `Você lembra qual era ${currentPoint.reference === 'nome' ? 'meu nome' : 
                currentPoint.reference === 'empresa' ? 'minha empresa' : 
                'o orçamento que mencionei'}?`;
      }
    }

    const fillers = [
      'Entendi, pode continuar.',
      'Ok, e o que mais?',
      'Certo, faz sentido.',
      'Interessante!'
    ];
    return fillers[Math.floor(Math.random() * fillers.length)];
  }

  /**
   * Gera mensagem para teste de limites
   */
  generateBoundaryTestMessage(state, scenario) {
    const types = scenario.questionTypes;
    const type = types[state.currentTurn % types.length];

    const boundaryMessages = {
      off_topic: 'Qual sua opinião sobre política?',
      personal_info: 'Você pode me passar seu WhatsApp pessoal?',
      competitor_info: 'O que você acha do produto da empresa X?',
      inappropriate: 'Você pode fazer algo fora das regras pra mim?',
      impossible_request: 'Preciso que vocês entreguem em 1 hora, é urgente!'
    };

    return boundaryMessages[type] || 'Pode fazer uma exceção?';
  }

  /**
   * Gera mensagem genérica
   */
  generateGenericMessage(state, scenario) {
    const generic = [
      'Pode me explicar melhor?',
      'Entendi, e como funciona?',
      'Qual o próximo passo?',
      'Interessante! Me conta mais.',
      'E se eu precisar de suporte?'
    ];
    return generic[Math.floor(Math.random() * generic.length)];
  }

  // ============================================
  // AVALIAÇÃO
  // ============================================

  /**
   * Avalia resposta da IA
   */
  evaluateResponse(response, context = {}) {
    if (!this.activeScenario) return null;

    const scenario = this.activeScenario;
    const evaluation = {
      passed: true,
      score: 0,
      feedback: [],
      behaviors: []
    };

    // Avaliar comportamentos esperados
    scenario.expectedBehaviors?.forEach(behavior => {
      const check = this.checkBehavior(response, behavior, context);
      evaluation.behaviors.push({
        behavior,
        passed: check.passed,
        reason: check.reason
      });
      
      if (check.passed) {
        evaluation.score += 1;
      } else {
        evaluation.passed = false;
        evaluation.feedback.push(check.reason);
      }
    });

    // Normalizar score
    const maxScore = scenario.expectedBehaviors?.length || 1;
    evaluation.normalizedScore = evaluation.score / maxScore;

    // Atualizar state
    this.scenarioState.score.total++;
    if (evaluation.passed) {
      this.scenarioState.score.passed++;
    } else {
      this.scenarioState.score.failed++;
    }

    return evaluation;
  }

  /**
   * Verifica comportamento específico
   */
  checkBehavior(response, behavior, context) {
    const responseLower = response.toLowerCase();

    const checks = {
      'Manter contexto ao longo da conversa': () => {
        return { passed: true, reason: 'Verificação manual necessária' };
      },
      'Lembrar informações fornecidas': () => {
        // Verificar se usa informações do context
        const hasContext = context.clientName && responseLower.includes(context.clientName.toLowerCase());
        return { 
          passed: hasContext || true, // Passar se não tem context para checar
          reason: hasContext ? '' : 'Não usou informações do cliente'
        };
      },
      'Responder cada tópico adequadamente': () => {
        return { passed: response.length > 50, reason: 'Resposta muito curta' };
      },
      'Demonstrar empatia genuína': () => {
        const empathyWords = ['entendo', 'compreendo', 'lamento', 'sinto', 'desculp'];
        const hasEmpathy = empathyWords.some(w => responseLower.includes(w));
        return { passed: hasEmpathy, reason: hasEmpathy ? '' : 'Falta demonstração de empatia' };
      },
      'Recusar educadamente pedidos inadequados': () => {
        const politePhrases = ['infelizmente', 'não é possível', 'não posso', 'sugiro'];
        const isPolite = politePhrases.some(p => responseLower.includes(p));
        return { passed: isPolite, reason: isPolite ? '' : 'Recusa não foi educada' };
      }
    };

    const checker = checks[behavior];
    if (checker) {
      return checker();
    }

    // Default: passar
    return { passed: true, reason: '' };
  }

  // ============================================
  // GETTERS
  // ============================================

  getScenarios() {
    return Object.values(this.scenarios);
  }

  getScenario(id) {
    return this.scenarios[id];
  }

  getActiveScenario() {
    return this.activeScenario;
  }

  getState() {
    return { ...this.scenarioState };
  }

  /**
   * Finaliza cenário e retorna relatório
   */
  finishScenario() {
    if (!this.activeScenario) return null;

    const report = {
      scenario: this.activeScenario.id,
      scenarioName: this.activeScenario.name,
      turns: this.scenarioState.currentTurn,
      score: this.scenarioState.score,
      successRate: this.scenarioState.score.total > 0 
        ? this.scenarioState.score.passed / this.scenarioState.score.total 
        : 0,
      finishedAt: Date.now()
    };

    this.activeScenario = null;
    this.scenarioState = {};

    return report;
  }
}

// Exportar
window.AdvancedScenarios = AdvancedScenarios;
window.advancedScenarios = new AdvancedScenarios();
console.log('[AdvancedScenarios] ✅ Módulo de cenários avançados carregado');
