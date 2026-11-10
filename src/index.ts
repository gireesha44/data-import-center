/**
 * Main Entrypoint for Data Import Centre
 */

import { createApp } from './app.js';
import { logger } from './core/logging/structured-logger.js';

// Re-export core modules for package consumption
export * from './core/types/import.types.js';
export * from './core/types/permissions.types.js';
export * from './core/errors/import.errors.js';
export * from './core/config/import.config.js';
export * from './core/logging/structured-logger.js';
export * from './core/registry/entity-schema.registry.js';
export * from './domain/entities/data-import.entity.js';
export * from './domain/entities/data-import-source.entity.js';
export * from './domain/entities/data-import-mapping.entity.js';
export * from './domain/entities/data-import-template.entity.js';
export * from './domain/entities/data-import-record.entity.js';
export * from './domain/entities/data-import-approval.entity.js';
export * from './domain/entities/data-import-execution.entity.js';
export * from './domain/entities/data-import-audit-log.entity.js';
export * from './domain/state-machine/import-state-machine.js';
export * from './domain/repositories/data-import.repository.interface.js';
export * from './infrastructure/repositories/in-memory-data-import.repository.js';
export * from './domain/services/audit.service.interface.js';
export * from './infrastructure/services/audit.service.js';
export * from './domain/services/import.service.js';
export * from './core/types/parser.types.js';
export * from './infrastructure/storage/file-storage.service.js';
export * from './infrastructure/security/file-security-validator.js';
export * from './infrastructure/parsers/csv.parser.js';
export * from './infrastructure/parsers/excel.parser.js';
export * from './infrastructure/parsers/json.parser.js';
export * from './infrastructure/parsers/xml.parser.js';
export * from './infrastructure/parsers/parser.factory.js';
export * from './domain/services/file-ingestion.service.js';
export * from './app.js';

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  app.listen(PORT, () => {
    logger.info(`Data Import Centre service started on port ${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development'
    });
  });
}
