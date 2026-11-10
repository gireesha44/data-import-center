/**
 * Secure File Storage Service
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SecurityViolationError, NotFoundError } from '../../core/errors/import.errors.js';
import { ImportConfigService } from '../../core/config/import.config.js';

export interface StoredFileResult {
  storagePath: string;
  storageKey: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface IFileStorageService {
  saveFile(
    organizationId: string,
    importId: string,
    originalFilename: string,
    content: Buffer,
    category?: 'source' | 'cleaned' | 'errors' | 'reports' | 'document-vault'
  ): Promise<StoredFileResult>;
  readFile(storagePath: string): Promise<Buffer>;
  deleteFile(storagePath: string): Promise<boolean>;
  exists(storagePath: string): Promise<boolean>;
}

export class LocalFileStorageService implements IFileStorageService {
  private getBasePath(): string {
    return path.resolve(ImportConfigService.get().tempStoragePath);
  }

  /**
   * Sanitizes original filename to prevent directory traversal and null-byte injection.
   */
  public sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed_file';
    }

    // Normalize both POSIX and Windows separators before taking the final
    // path component. path.basename() only understands the host OS separator.
    const normalized = filename.replace(/[\\/]+/g, '/').replace(/\0/g, '');
    const base = path.posix.basename(normalized);

    // Reject traversal components and control characters after normalization.
    const sanitized = base
      .replace(/[\\/:*?"<>|\x00-\x1F\x7F]/g, '')
      .replace(/^\.+$/, '')
      .trim();

    return sanitized.length > 0 ? sanitized : 'sanitized_upload';
  }

  /**
   * Saves uploaded file to isolated tenant/import storage path.
   */
  public async saveFile(
    organizationId: string,
    importId: string,
    originalFilename: string,
    content: Buffer,
    category: 'source' | 'cleaned' | 'errors' | 'reports' | 'document-vault' = 'source'
  ): Promise<StoredFileResult> {
    // Validate organization and import IDs
    if (!organizationId || !importId) {
      throw new SecurityViolationError('Organization ID and Import ID are required for file storage');
    }

    const sanitizedOrg = organizationId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedImport = importId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedCategory = category.replace(/[^a-zA-Z0-9_-]/g, '_');

    const sanitizedName = this.sanitizeFilename(originalFilename);
    const ext = path.extname(sanitizedName) || '.dat';
    const storageKey = `${crypto.randomUUID()}${ext}`;

    const targetDir = path.join(this.getBasePath(), 'tenants', sanitizedOrg, 'imports', sanitizedImport, sanitizedCategory);
    await fs.promises.mkdir(targetDir, { recursive: true });

    const storagePath = path.join(targetDir, storageKey);

    // Verify target path stays strictly inside base storage directory
    const resolvedPath = path.resolve(storagePath);
    const basePath = path.resolve(this.getBasePath());
    const relativePath = path.relative(basePath, resolvedPath);
    if (relativePath.startsWith('..' + path.sep) || relativePath === '..' || path.isAbsolute(relativePath)) {
      throw new SecurityViolationError('Invalid storage path traversal attempt');
    }

    await fs.promises.writeFile(resolvedPath, content);

    const checksumSha256 = crypto.createHash('sha256').update(content).digest('hex');

    return {
      storagePath: resolvedPath,
      storageKey,
      sizeBytes: content.length,
      checksumSha256
    };
  }

  public async readFile(storagePath: string): Promise<Buffer> {
    const resolved = path.resolve(storagePath);
    const basePath = path.resolve(this.getBasePath());
    const relativePath = path.relative(basePath, resolved);
    if (relativePath.startsWith('..' + path.sep) || relativePath === '..' || path.isAbsolute(relativePath)) {
      throw new SecurityViolationError('Access to path outside storage directory is forbidden');
    }

    try {
      return await fs.promises.readFile(resolved);
    } catch (err) {
      throw new NotFoundError(`Stored file at '${storagePath}' not found or inaccessible`);
    }
  }

  public async deleteFile(storagePath: string): Promise<boolean> {
    const resolved = path.resolve(storagePath);
    const basePath = path.resolve(this.getBasePath());
    const relativePath = path.relative(basePath, resolved);
    if (relativePath.startsWith('..' + path.sep) || relativePath === '..' || path.isAbsolute(relativePath)) {
      throw new SecurityViolationError('Access to path outside storage directory is forbidden');
    }

    try {
      await fs.promises.unlink(resolved);
      return true;
    } catch {
      return false;
    }
  }

  public async exists(storagePath: string): Promise<boolean> {
    const resolved = path.resolve(storagePath);
    const basePath = path.resolve(this.getBasePath());
    const relativePath = path.relative(basePath, resolved);
    if (relativePath.startsWith('..' + path.sep) || relativePath === '..' || path.isAbsolute(relativePath)) {
      return false;
    }

    try {
      await fs.promises.access(resolved, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

export const fileStorageService = new LocalFileStorageService();
