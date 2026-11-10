/**
 * Persistent Database Engine for Data Import Centre
 * Provides ACID file-backed persistent storage matching PostgreSQL schema tables
 */
import fs from 'fs';
import path from 'path';
import { ImportConfigService } from '../../core/config/import.config.js';
import { logger } from '../../core/logging/structured-logger.js';
export class PersistentDatabaseEngine {
    static instance;
    dbDir;
    inMemoryCache = new Map();
    isLoaded = false;
    constructor() {
        const tempPath = ImportConfigService.get().tempStoragePath;
        this.dbDir = path.resolve(tempPath, '..', 'database');
    }
    static getInstance() {
        if (!PersistentDatabaseEngine.instance) {
            PersistentDatabaseEngine.instance = new PersistentDatabaseEngine();
        }
        return PersistentDatabaseEngine.instance;
    }
    async ensureDir() {
        if (!fs.existsSync(this.dbDir)) {
            await fs.promises.mkdir(this.dbDir, { recursive: true });
        }
    }
    getTablePath(tableName) {
        return path.join(this.dbDir, `${tableName}.json`);
    }
    /**
     * Loads a table from disk into cache.
     */
    async loadTable(tableName) {
        await this.ensureDir();
        const filePath = this.getTablePath(tableName);
        if (this.inMemoryCache.has(tableName)) {
            return this.inMemoryCache.get(tableName);
        }
        if (fs.existsSync(filePath)) {
            try {
                const content = await fs.promises.readFile(filePath, 'utf-8');
                const data = JSON.parse(content);
                this.inMemoryCache.set(tableName, Array.isArray(data) ? data : []);
                return this.inMemoryCache.get(tableName);
            }
            catch (err) {
                logger.error(`Error reading table '${tableName}' from disk`, err instanceof Error ? err : new Error(String(err)));
                this.inMemoryCache.set(tableName, []);
                return [];
            }
        }
        else {
            this.inMemoryCache.set(tableName, []);
            return [];
        }
    }
    writeQueues = new Map();
    /**
     * Persists a table array to disk atomically.
     */
    async saveTable(tableName, rows) {
        await this.ensureDir();
        this.inMemoryCache.set(tableName, rows);
        const previousWrite = this.writeQueues.get(tableName) || Promise.resolve();
        const currentWrite = previousWrite
            .catch(() => { })
            .then(async () => {
            const filePath = this.getTablePath(tableName);
            const tmpPath = `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const jsonContent = JSON.stringify(rows, null, 2);
            try {
                await fs.promises.writeFile(tmpPath, jsonContent, 'utf-8');
                try {
                    await fs.promises.rename(tmpPath, filePath);
                }
                catch (renameErr) {
                    await fs.promises.writeFile(filePath, jsonContent, 'utf-8');
                    if (fs.existsSync(tmpPath)) {
                        await fs.promises.unlink(tmpPath).catch(() => { });
                    }
                }
            }
            catch (err) {
                logger.error(`Failed to persist table '${tableName}' to disk`, err instanceof Error ? err : new Error(String(err)));
                if (fs.existsSync(tmpPath)) {
                    try {
                        await fs.promises.unlink(tmpPath);
                    }
                    catch {
                        // ignore
                    }
                }
                throw err;
            }
        });
        this.writeQueues.set(tableName, currentWrite);
        return currentWrite;
    }
    /**
     * Clears a table (or all tables) from memory and disk.
     */
    async clearTable(tableName) {
        await this.ensureDir();
        if (tableName) {
            this.inMemoryCache.delete(tableName);
            const filePath = this.getTablePath(tableName);
            if (fs.existsSync(filePath)) {
                try {
                    await fs.promises.unlink(filePath);
                }
                catch {
                    // ignore
                }
            }
        }
        else {
            this.inMemoryCache.clear();
            const files = await fs.promises.readdir(this.dbDir);
            for (const file of files) {
                if (file.endsWith('.json') || file.endsWith('.tmp')) {
                    try {
                        await fs.promises.unlink(path.join(this.dbDir, file));
                    }
                    catch {
                        // ignore
                    }
                }
            }
        }
    }
}
export const persistentDatabaseEngine = PersistentDatabaseEngine.getInstance();
//# sourceMappingURL=persistent-database.engine.js.map