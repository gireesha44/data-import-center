/**
 * Secure File Storage Service
 */
export interface StoredFileResult {
    storagePath: string;
    storageKey: string;
    sizeBytes: number;
    checksumSha256: string;
}
export interface IFileStorageService {
    saveFile(organizationId: string, importId: string, originalFilename: string, content: Buffer, category?: 'source' | 'cleaned' | 'errors' | 'reports' | 'document-vault'): Promise<StoredFileResult>;
    readFile(storagePath: string): Promise<Buffer>;
    deleteFile(storagePath: string): Promise<boolean>;
    exists(storagePath: string): Promise<boolean>;
}
export declare class LocalFileStorageService implements IFileStorageService {
    private getBasePath;
    /**
     * Sanitizes original filename to prevent directory traversal and null-byte injection.
     */
    sanitizeFilename(filename: string): string;
    /**
     * Saves uploaded file to isolated tenant/import storage path.
     */
    saveFile(organizationId: string, importId: string, originalFilename: string, content: Buffer, category?: 'source' | 'cleaned' | 'errors' | 'reports' | 'document-vault'): Promise<StoredFileResult>;
    readFile(storagePath: string): Promise<Buffer>;
    deleteFile(storagePath: string): Promise<boolean>;
    exists(storagePath: string): Promise<boolean>;
}
export declare const fileStorageService: LocalFileStorageService;
//# sourceMappingURL=file-storage.service.d.ts.map