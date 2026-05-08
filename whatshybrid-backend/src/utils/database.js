/**
 * Database — v9.0.0
 *
 * Entry point que delega para o driver configurado (sqlite ou postgres).
 * Mantém a API esperada pelo código existente: run, get, all, transaction,
 * exec, close, getDb, initialize, runMigrations.
 *
 * Para forçar driver: env var DB_DRIVER=sqlite|postgres
 * Para SQLite custom path: DB_PATH=/path/to/file.db
 * Para Postgres: DATABASE_URL=postgres://user:pass@host:5432/dbname
 */

const driver = require('./db');
const logger = require('./logger');

// Re-exporta API do driver
module.exports = {
  ...driver,

  /**
   * Aplica migrations idempotentes.
   * Chama runMigrations do legacy database.js (que conhece o schema completo)
   * E também aplica migrations versionadas em /migrations
   */
  async runMigrations() {
    const legacy = require('./database-legacy');
    if (typeof legacy.runMigrations === 'function') {
      try {
        legacy.runMigrations(driver.driver === 'sqlite' ? driver.getDb() : null);
        logger.info('[DB] Legacy migrations applied');
      } catch (err) {
        logger.warn(`[DB] Legacy migrations issue: ${err.message}`);
      }
    }

    // Aplica migrations versionadas
    try {
      const { runVersionedMigrations } = require('./migration-runner');
      await runVersionedMigrations(driver);
    } catch (err) {
      logger.warn(`[DB] Versioned migrations issue: ${err.message}`);
    }
  },
};
