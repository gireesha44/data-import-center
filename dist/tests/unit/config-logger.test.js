/**
 * Unit Tests: Configuration & Structured Logger
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ImportConfigService } from '../../core/config/import.config.js';
import { StructuredLogger } from '../../core/logging/structured-logger.js';
describe('Configuration & Structured Logger', () => {
    beforeEach(() => {
        ImportConfigService.reset();
    });
    it('should return default configuration parameters', () => {
        const config = ImportConfigService.get();
        assert.equal(config.defaultBatchSize, 500);
        assert.equal(config.maxRecordsCount, 500000);
        assert.ok(config.allowedMimeTypes.includes('text/csv'));
        assert.ok(config.allowedMimeTypes.includes('application/json'));
    });
    it('should update configuration overrides cleanly', () => {
        ImportConfigService.update({
            defaultBatchSize: 1000,
            maxRecordsCount: 1000000
        });
        const updated = ImportConfigService.get();
        assert.equal(updated.defaultBatchSize, 1000);
        assert.equal(updated.maxRecordsCount, 1000000);
    });
    it('should reset configuration back to baseline defaults', () => {
        ImportConfigService.update({ defaultBatchSize: 200 });
        ImportConfigService.reset();
        const config = ImportConfigService.get();
        assert.equal(config.defaultBatchSize, 500);
    });
    it('should log structured messages without crashing', () => {
        const customLogger = new StructuredLogger('TestLogger');
        // Test debug, info, warn, error
        assert.doesNotThrow(() => {
            customLogger.debug('Debug test', { importId: '123' });
            customLogger.info('Info test', {
                operation: 'CREATE',
                password: 'superSecretPassword',
                apiKey: 'sk-123456789'
            });
            customLogger.warn('Warning test', { reason: 'high_load' });
            customLogger.error('Error test', new Error('Something failed'), { importId: '123' });
        });
    });
});
//# sourceMappingURL=config-logger.test.js.map