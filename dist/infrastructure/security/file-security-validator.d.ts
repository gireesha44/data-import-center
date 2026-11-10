/**
 * File Security Validator
 * Inspects magic bytes, detects true file formats, prevents MIME spoofing, zip bombs, and XXE.
 */
import { ImportFileFormat } from '../../core/types/import.types.js';
export interface FileValidationResult {
    isValid: boolean;
    detectedFormat: ImportFileFormat;
    mimeType: string;
    encoding: string;
    sizeBytes: number;
}
export declare class FileSecurityValidator {
    /**
     * Magic number signatures for supported formats
     */
    private static readonly ZIP_MAGIC;
    private static readonly OLE_MAGIC;
    private static readonly EXE_MAGIC_MZ;
    private static readonly ELF_MAGIC;
    /**
     * Validates file buffer, size, magic numbers, and returns detected format.
     */
    static validate(originalFilename: string, buffer: Buffer, declaredMime?: string): FileValidationResult;
    private static matchesMagic;
    /**
     * Discovers the actual format through binary signature inspection and content heuristics.
     */
    static detectFormat(extension: string, buffer: Buffer): {
        format: ImportFileFormat;
        mimeType: string;
        encoding: string;
    };
    /**
     * Scans XML content for dangerous DOCTYPE, ENTITY expansion, and SYSTEM entity markers (XXE).
     */
    private static checkXmlSecurity;
}
//# sourceMappingURL=file-security-validator.d.ts.map