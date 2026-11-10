/**
 * Unit Tests: File Storage Service
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { LocalFileStorageService } from '../../../infrastructure/storage/file-storage.service.js';
describe('LocalFileStorageService', () => {
    const storage = new LocalFileStorageService();
    it('should sanitize path traversal attempts from filenames', () => {
        assert.equal(storage.sanitizeFilename('../../../etc/passwd'), 'passwd');
        assert.equal(storage.sanitizeFilename('..\\..\\windows\\system32\\calc.exe'), 'calc.exe');
        assert.equal(storage.sanitizeFilename('normal_data.csv'), 'normal_data.csv');
        assert.equal(storage.sanitizeFilename('file\0with_null.csv'), 'filewith_null.csv');
    });
    it('should save file and return storage path and valid SHA256 checksum', async () => {
        const orgId = 'org_storage_test';
        const importId = 'import_101';
        const filename = 'sample.csv';
        const content = Buffer.from('id,name\n1,Alpha\n2,Beta', 'utf-8');
        const expectedChecksum = crypto.createHash('sha256').update(content).digest('hex');
        const result = await storage.saveFile(orgId, importId, filename, content);
        assert.ok(result.storagePath);
        assert.equal(result.sizeBytes, content.length);
        assert.equal(result.checksumSha256, expectedChecksum);
        // Read back content
        const readContent = await storage.readFile(result.storagePath);
        assert.deepEqual(readContent, content);
        // Clean up
        const deleted = await storage.deleteFile(result.storagePath);
        assert.equal(deleted, true);
    });
});
//# sourceMappingURL=file-storage.test.js.map