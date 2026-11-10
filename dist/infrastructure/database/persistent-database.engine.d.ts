/**
 * Persistent Database Engine for Data Import Centre
 * Provides ACID file-backed persistent storage matching PostgreSQL schema tables
 */
export declare class PersistentDatabaseEngine {
    private static instance;
    private dbDir;
    private inMemoryCache;
    private isLoaded;
    private constructor();
    static getInstance(): PersistentDatabaseEngine;
    private ensureDir;
    private getTablePath;
    /**
     * Loads a table from disk into cache.
     */
    loadTable<T = any>(tableName: string): Promise<T[]>;
    private writeQueues;
    /**
     * Persists a table array to disk atomically.
     */
    saveTable<T = any>(tableName: string, rows: T[]): Promise<void>;
    /**
     * Clears a table (or all tables) from memory and disk.
     */
    clearTable(tableName?: string): Promise<void>;
}
export declare const persistentDatabaseEngine: PersistentDatabaseEngine;
//# sourceMappingURL=persistent-database.engine.d.ts.map