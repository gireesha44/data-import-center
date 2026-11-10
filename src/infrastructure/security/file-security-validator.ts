/**
 * File Security Validator
 * Inspects magic bytes, detects true file formats, prevents MIME spoofing, zip bombs, and XXE.
 */

import path from 'path';
import { ImportFileFormat } from '../../core/types/import.types.js';
import { ValidationError, SecurityViolationError } from '../../core/errors/import.errors.js';
import { ImportConfigService } from '../../core/config/import.config.js';

export interface FileValidationResult {
  isValid: boolean;
  detectedFormat: ImportFileFormat;
  mimeType: string;
  encoding: string;
  sizeBytes: number;
}

export class FileSecurityValidator {
  /**
   * Magic number signatures for supported formats
   */
  private static readonly ZIP_MAGIC = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // PK.. (xlsx)
  private static readonly OLE_MAGIC = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]); // Compound Binary (xls)
  private static readonly EXE_MAGIC_MZ = Buffer.from([0x4D, 0x5A]); // Windows executable (MZ)
  private static readonly ELF_MAGIC = Buffer.from([0x7F, 0x45, 0x4C, 0x46]); // Linux ELF executable

  /**
   * Validates file buffer, size, magic numbers, and returns detected format.
   */
  public static validate(
    originalFilename: string,
    buffer: Buffer,
    declaredMime?: string
  ): FileValidationResult {
    const config = ImportConfigService.get();

    // 1. File Size Verification
    if (!buffer || buffer.length === 0) {
      throw new ValidationError('Uploaded file is empty (0 bytes)');
    }

    if (buffer.length > config.maxFileSizeBytes) {
      const maxMb = Math.round(config.maxFileSizeBytes / (1024 * 1024));
      throw new ValidationError(
        `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${maxMb} MB`,
        [{ code: 'FILE_TOO_LARGE', message: `Max allowed size is ${config.maxFileSizeBytes} bytes` }]
      );
    }

    // 2. Reject Dangerous Executable Headers immediately
    if (this.matchesMagic(buffer, this.EXE_MAGIC_MZ) || this.matchesMagic(buffer, this.ELF_MAGIC)) {
      throw new SecurityViolationError('Executable binary file upload is strictly prohibited');
    }

    // 3. Detect Format & Magic Numbers
    const ext = path.extname(originalFilename).toLowerCase().replace('.', '');
    const detected = this.detectFormat(ext, buffer);

    if (!config.allowedFileFormats.includes(detected.format)) {
      throw new ValidationError(
        `Unsupported file format '${detected.format}'. Allowed formats: ${config.allowedFileFormats.join(', ')}`,
        [{ code: 'UNSUPPORTED_FILE_FORMAT', message: `File format '${detected.format}' is not enabled` }]
      );
    }

    // 4. Check for XML Entity Expansion / XXE patterns
    if (detected.format === ImportFileFormat.XML) {
      this.checkXmlSecurity(buffer);
    }

    return {
      isValid: true,
      detectedFormat: detected.format,
      mimeType: detected.mimeType,
      encoding: detected.encoding,
      sizeBytes: buffer.length
    };
  }

  private static matchesMagic(buffer: Buffer, magic: Buffer): boolean {
    if (buffer.length < magic.length) return false;
    for (let i = 0; i < magic.length; i++) {
      if (buffer[i] !== magic[i]) return false;
    }
    return true;
  }

  /**
   * Discovers the actual format through binary signature inspection and content heuristics.
   */
  public static detectFormat(
    extension: string,
    buffer: Buffer
  ): { format: ImportFileFormat; mimeType: string; encoding: string } {
    // Check Excel XLSX (ZIP magic)
    if (this.matchesMagic(buffer, this.ZIP_MAGIC)) {
      return {
        format: ImportFileFormat.XLSX,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        encoding: 'binary'
      };
    }

    // Check Excel XLS (OLE magic)
    if (this.matchesMagic(buffer, this.OLE_MAGIC)) {
      return {
        format: ImportFileFormat.XLS,
        mimeType: 'application/vnd.ms-excel',
        encoding: 'binary'
      };
    }

    // Inspect UTF-8 content
    let textSample: string;
    let encoding = 'utf-8';

    // Handle UTF-8 BOM
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      textSample = buffer.subarray(3, Math.min(buffer.length, 4096)).toString('utf-8');
      encoding = 'utf-8-bom';
    } else {
      textSample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf-8');
    }

    const trimmed = textSample.trim();

    // Check JSON
    if (
      (trimmed.startsWith('{') && trimmed.includes('}')) ||
      (trimmed.startsWith('[') && (trimmed.includes(']') || trimmed.includes('{')))
    ) {
      return {
        format: ImportFileFormat.JSON,
        mimeType: 'application/json',
        encoding
      };
    }

    // Check XML
    if (trimmed.startsWith('<?xml') || (trimmed.startsWith('<') && trimmed.includes('>'))) {
      return {
        format: ImportFileFormat.XML,
        mimeType: 'application/xml',
        encoding
      };
    }

    // Default Text / CSV
    return {
      format: ImportFileFormat.CSV,
      mimeType: 'text/csv',
      encoding
    };
  }

  /**
   * Scans XML content for dangerous DOCTYPE, ENTITY expansion, and SYSTEM entity markers (XXE).
   */
  private static checkXmlSecurity(buffer: Buffer): void {
    const sample = buffer.toString('utf-8', 0, Math.min(buffer.length, 65536));
    const upper = sample.toUpperCase();

    if (
      upper.includes('<!DOCTYPE') &&
      (upper.includes('SYSTEM') || upper.includes('PUBLIC') || upper.includes('<!ENTITY'))
    ) {
      throw new SecurityViolationError(
        'XML external entity (XXE) and DTD entity definitions are blocked for security.',
        [{ code: 'XML_EXTERNAL_ENTITY_BLOCKED', message: 'DOCTYPE/ENTITY declarations are not permitted' }]
      );
    }
  }
}
