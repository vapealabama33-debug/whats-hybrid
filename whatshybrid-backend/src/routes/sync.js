/**
 * 🔄 Sync Routes - Sincronização Bidirecional de Dados
 * 
 * Endpoints para sincronizar dados entre a extensão e o backend.
 * Garante persistência de dados mesmo após limpeza de cookies/cache.
 * 
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('../utils/uuid-wrapper');
const db = require('../utils/database');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Aplicar autenticação a todas as rotas
router.use(authenticate);

// ============================================
// TABELA DE SYNC
// ============================================

// Criar tabela de sync se não existir
const initSyncTables = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS sync_data (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        module TEXT NOT NULL,
        data TEXT,
        last_modified INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);
    
    await db.run(`CREATE INDEX IF NOT EXISTS idx_sync_user_module ON sync_data(user_id, module)`);
    
    logger.info('[SyncRoutes] Tabelas de sync inicializadas');
  } catch (e) {
    logger.error('[SyncRoutes] Erro ao inicializar tabelas:', e);
  }
};

// Inicializar tabelas
initSyncTables();

// ============================================
// ORDEM CORRETA DAS ROTAS (específicas antes de paramétricas)
// ============================================

// 1. Rotas específicas (não paramétricas)

// GET /api/v1/sync/status - Status de todos os módulos
router.get('/status', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const modules = await db.all(`
    SELECT module, last_modified, updated_at
    FROM sync_data
    WHERE user_id = ?
  `, [userId]);

  const status = {};
  for (const mod of modules) {
    status[mod.module] = {
      lastModified: mod.last_modified,
      updatedAt: mod.updated_at
    };
  }

  res.json({
    success: true,
    modules: status
  });
}));

// POST /api/v1/sync/export - Exportar todos os dados
router.post('/export', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const records = await db.all(`
    SELECT module, data, last_modified
    FROM sync_data
    WHERE user_id = ?
  `, [userId]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    userId,
    modules: {}
  };

  for (const record of records) {
    try {
      exportData.modules[record.module] = JSON.parse(record.data);
    } catch (e) {
      exportData.modules[record.module] = record.data;
    }
  }

  res.json({
    success: true,
    data: exportData
  });
}));

// POST /api/v1/sync/import - Importar dados
router.post('/import', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { modules } = req.body;

  if (!modules || typeof modules !== 'object') {
    throw new AppError('Dados de importação inválidos', 400);
  }

  const now = Date.now();
  let imported = 0;

  for (const [module, data] of Object.entries(modules)) {
    // Verificar se já existe
    const existing = await db.get(`
      SELECT id FROM sync_data WHERE user_id = ? AND module = ?
    `, [userId, module]);

    if (existing) {
      await db.run(`
        UPDATE sync_data
        SET data = ?, last_modified = ?, updated_at = ?
        WHERE id = ?
      `, [JSON.stringify(data), now, now, existing.id]);
    } else {
      const id = uuidv4();
      await db.run(`
        INSERT INTO sync_data (id, user_id, module, data, last_modified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, userId, module, JSON.stringify(data), now, now, now]);
    }

    imported++;
  }

  res.json({
    success: true,
    imported,
    modules: Object.keys(modules)
  });
}));

// 2. Rotas com paths compostos (/:module/xxx)

// GET /api/v1/sync/:module/download - Baixar dados de um módulo
router.get('/:module/download', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { module } = req.params;

  const record = await db.get(`
    SELECT data, last_modified
    FROM sync_data
    WHERE user_id = ? AND module = ?
  `, [userId, module]);

  if (!record) {
    return res.json({
      success: true,
      data: null,
      lastModified: 0
    });
  }

  let data;
  try {
    data = JSON.parse(record.data);
  } catch (e) {
    data = record.data;
  }

  res.json({
    success: true,
    data,
    lastModified: record.last_modified
  });
}));

// DELETE /api/v1/sync/:module/all - Deletar todos os dados do módulo
router.delete('/:module/all', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { module } = req.params;

  await db.run(`
    DELETE FROM sync_data
    WHERE user_id = ? AND module = ?
  `, [userId, module]);

  res.json({
    success: true,
    message: 'Dados do módulo deletados'
  });
}));

// 3. Rotas paramétricas (por último!)

// POST /api/v1/sync/:module - Sincronizar módulo específico
router.post('/:module', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { module } = req.params;
  const { data, lastSync, timestamp } = req.body;
  
  if (!data) {
    throw new AppError('Dados não fornecidos', 400);
  }
  
  // Verificar se já existe registro
  const existing = await db.get(`
    SELECT id, data, last_modified
    FROM sync_data
    WHERE user_id = ? AND module = ?
  `, [userId, module]);
  
  const now = Date.now();
  let mergeNeeded = false;
  let mergedData = data;
  
  if (existing) {
    // Se o backend tem dados mais recentes, precisamos mesclar
    if (existing.last_modified > lastSync) {
      mergeNeeded = true;
      
      try {
        const backendData = JSON.parse(existing.data);
        mergedData = mergeData(backendData, data);
      } catch (e) {
        logger.warn('[SyncRoutes] Erro ao mesclar dados:', e);
        mergedData = data;
      }
    }
    
    // Atualizar registro
    await db.run(`
      UPDATE sync_data
      SET data = ?, last_modified = ?, updated_at = ?
      WHERE id = ?
    `, [JSON.stringify(mergedData), now, now, existing.id]);
  } else {
    // Criar novo registro
    const id = uuidv4();
    await db.run(`
      INSERT INTO sync_data (id, user_id, module, data, last_modified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, userId, module, JSON.stringify(data), now, now, now]);
  }
  
  res.json({
    success: true,
    module,
    lastModified: now,
    mergeNeeded,
    data: mergeNeeded ? mergedData : null
  });
}));

// DELETE /api/v1/sync/:module/:itemId - Deletar item específico
router.delete('/:module/:itemId', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { module, itemId } = req.params;

  const record = await db.get(`
    SELECT id, data
    FROM sync_data
    WHERE user_id = ? AND module = ?
  `, [userId, module]);

  if (!record) {
    return res.json({ success: true, message: 'Módulo não encontrado' });
  }

  try {
    let data = JSON.parse(record.data);

    if (Array.isArray(data)) {
      data = data.filter(item => (item.id || item.key) !== itemId);

      await db.run(`
        UPDATE sync_data
        SET data = ?, last_modified = ?, updated_at = ?
        WHERE id = ?
      `, [JSON.stringify(data), Date.now(), Date.now(), record.id]);
    }
  } catch (e) {
    logger.error('[SyncRoutes] Erro ao deletar item:', e);
    throw new AppError('Erro ao deletar item', 500);
  }

  res.json({
    success: true,
    message: 'Item deletado'
  });
}));

// ============================================
// HELPER: Mesclar dados
// ============================================
function mergeData(backendData, clientData) {
  // Se ambos são arrays, mesclar por ID
  if (Array.isArray(backendData) && Array.isArray(clientData)) {
    const merged = new Map();
    
    // Adicionar itens do backend
    for (const item of backendData) {
      const id = item.id || item.key || JSON.stringify(item);
      merged.set(id, item);
    }
    
    // Adicionar/atualizar com itens do cliente
    for (const item of clientData) {
      const id = item.id || item.key || JSON.stringify(item);
      const existing = merged.get(id);
      
      // Se não existe ou o cliente tem versão mais recente, usar do cliente
      if (!existing || 
          (item.updatedAt && existing.updatedAt && item.updatedAt > existing.updatedAt)) {
        merged.set(id, item);
      }
    }
    
    return Array.from(merged.values());
  }
  
  // Se são objetos, mesclar propriedades
  if (typeof backendData === 'object' && typeof clientData === 'object') {
    return { ...backendData, ...clientData };
  }
  
  // Caso contrário, usar dados do cliente
  return clientData;
}

module.exports = router;
