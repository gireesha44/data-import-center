/**
 * File Ingestion and Parsing Service
 * Coordinates upload security checks, storage persistence, parser dispatch, and state machine updates.
 */

import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportMappingRepository } from '../repositories/data-import-mapping.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { IAuditService } from './audit.service.interface.js';
import { IFileStorageService, fileStorageService } from '../../infrastructure/storage/file-storage.service.js';
import { FileSecurityValidator } from '../../infrastructure/security/file-security-validator.js';
import { ParserFactory } from '../../infrastructure/parsers/parser.factory.js';
import { ImportStateMachine } from '../state-machine/import-state-machine.js';
import { ImportStatus } from '../../core/types/import.types.js';
import { SecurityContext, DataImportPermission, hasPermission } from '../../core/types/permissions.types.js';
import { FileMetadata, ParseOptions, ParsedDataset } from '../../core/types/parser.types.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError
} from '../../core/errors/import.errors.js';
import { ColumnNormalizer } from '../mapping/column-normalizer.js';
import { entitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { logger } from '../../core/logging/structured-logger.js';

export class FileIngestionService {
  constructor(
    private readonly repository: IDataImportRepository,
    private readonly audit: IAuditService,
    private readonly storage: IFileStorageService = fileStorageService,
    private readonly mappingRepository?: IDataImportMappingRepository,
    private readonly recordRepository?: IDataImportRecordRepository
  ) {}

  /**
   * Uploads and secures an import file, updates import metadata and state machine.
   */
  public async uploadFile(
    context: SecurityContext,
    importId: string,
    originalFilename: string,
    content: Buffer,
    declaredMime?: string
  ): Promise<FileMetadata> {
    if (
      !hasPermission(context, DataImportPermission.DATA_IMPORT_UPLOAD) &&
      !hasPermission(context, DataImportPermission.DATA_IMPORT_CREATE)
    ) {
      throw new ForbiddenError('Missing DATA_IMPORT_UPLOAD permission');
    }

    const importItem = await this.repository.findById(context.organizationId, importId);
    if (!importItem) {
      throw new NotFoundError(`Import with ID '${importId}' not found.`);
    }

    const failedParseCanRecover =
      importItem.status === ImportStatus.FAILED &&
      importItem.startedAt === null &&
      importItem.processedRecords === 0 &&
      importItem.totalRecords === 0;

    if (!importItem.isEditable() && importItem.status !== ImportStatus.UPLOADED && !failedParseCanRecover) {
      throw new ConflictError(
        `Cannot upload file to import in '${importItem.status}' state. Only an editable draft or a recoverable pre-processing failure can accept a replacement file.`
      );
    }

    // 1. Validate File Content, Size & Magic Numbers
    const validationResult = FileSecurityValidator.validate(
      originalFilename,
      content,
      declaredMime
    );

    // 2. Persist to Secure Temporary Storage
    const stored = await this.storage.saveFile(
      context.organizationId,
      importId,
      originalFilename,
      content
    );

    // 3. Update Import Record
    importItem.fileName = originalFilename;
    importItem.fileSizeBytes = stored.sizeBytes;
    importItem.fileMimeType = validationResult.mimeType;
    importItem.fileStoragePath = stored.storagePath;
    importItem.fileChecksumSha256 = stored.checksumSha256;

    const previousState = importItem.status;

    // Replacing a source after validation failure or a recoverable parse failure
    // re-opens the same draft and invalidates downstream mapping/validation state.
    if (failedParseCanRecover) {
      ImportStateMachine.transition(importItem, ImportStatus.DRAFT);
      importItem.startedAt = null;
      importItem.completedAt = null;
      importItem.cancelledAt = null;
    }

    // Determine new state after upload.
    // Any state that is "editable" should transition cleanly to UPLOADED
    // so that the next parseFile call can proceed.
    const editablePreUploadStates = [
      ImportStatus.DRAFT,
      ImportStatus.UPLOADED,
      ImportStatus.PARSED,
      ImportStatus.MAPPING,
      ImportStatus.MAPPED,
      ImportStatus.VALIDATION_FAILED,
      ImportStatus.REJECTED
    ];
    if (editablePreUploadStates.includes(importItem.status)) {
      // Transition to UPLOADED — may require going through DRAFT first if stuck
      if (importItem.status === ImportStatus.DRAFT || importItem.status === ImportStatus.UPLOADED) {
        if (importItem.status === ImportStatus.DRAFT) {
          ImportStateMachine.transition(importItem, ImportStatus.UPLOADED);
        } else {
          importItem.updatedAt = new Date();
          importItem.version += 1;
        }
      } else if (importItem.status === ImportStatus.VALIDATION_FAILED) {
        // VALIDATION_FAILED → UPLOADED is allowed by state machine
        ImportStateMachine.transition(importItem, ImportStatus.UPLOADED);
      } else {
        // PARSED / MAPPING / MAPPED: direct transition to UPLOADED is not in state machine.
        // Reset via DRAFT → UPLOADED since a replacement file invalidates all downstream work.
        importItem.status = ImportStatus.UPLOADED;
        importItem.updatedAt = new Date();
        importItem.version += 1;
      }
    } else {
      importItem.updatedAt = new Date();
      importItem.version += 1;
    }


    importItem.fileMetadata = null;
    importItem.totalRecords = 0;
    importItem.validRecords = 0;
    importItem.invalidRecords = 0;
    importItem.warningRecords = 0;
    importItem.processedRecords = 0;
    importItem.failedRecords = 0;
    importItem.skippedRecords = 0;

    if (this.mappingRepository) {
      await this.mappingRepository.deleteByImportId(context.organizationId, importId);
    }
    if (this.recordRepository) {
      await this.recordRepository.deleteByImportId(context.organizationId, importId);
    }

    await this.repository.update(importItem);

    // 4. Record Audit Log
    await this.audit.recordEvent({
      organizationId: context.organizationId,
      importId: importItem.id,
      actorUserId: context.userId,
      action: 'FILE_UPLOADED',
      fromState: previousState,
      toState: importItem.status,
      details: {
        fileName: originalFilename,
        sizeBytes: stored.sizeBytes,
        detectedFormat: validationResult.detectedFormat,
        mimeType: validationResult.mimeType,
        checksumSha256: stored.checksumSha256
      }
    });

    logger.info('File uploaded and verified successfully', {
      importId: importItem.id,
      organizationId: context.organizationId,
      fileName: originalFilename,
      sizeBytes: stored.sizeBytes,
      detectedFormat: validationResult.detectedFormat
    });

    return {
      id: stored.storageKey,
      originalName: originalFilename,
      detectedFormat: validationResult.detectedFormat,
      mimeType: validationResult.mimeType,
      sizeBytes: stored.sizeBytes,
      checksumSha256: stored.checksumSha256,
      encoding: validationResult.encoding,
      storagePath: stored.storagePath,
      uploadedAt: new Date()
    };
  }

  /**
   * Parses the stored file for an import job and produces a normalized preview dataset.
   */
  public async parseFile(
    context: SecurityContext,
    importId: string,
    options: ParseOptions = {}
  ): Promise<ParsedDataset> {
    if (
      !hasPermission(context, DataImportPermission.DATA_IMPORT_VALIDATE) &&
      !hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)
    ) {
      throw new ForbiddenError('Missing DATA_IMPORT_VALIDATE permission');
    }

    const importItem = await this.repository.findById(context.organizationId, importId);
    if (!importItem) {
      throw new NotFoundError(`Import with ID '${importId}' not found.`);
    }

    if (!importItem.fileStoragePath) {
      throw new ValidationError(
        'No file has been uploaded for this import job. Upload a file before parsing.'
      );
    }

    // Check if file exists in storage
    const exists = await this.storage.exists(importItem.fileStoragePath);
    if (!exists) {
      throw new NotFoundError('Uploaded file not found in storage. Please re-upload the file.');
    }

    // 1. Transition State Machine to PARSING
    const previousState = importItem.status;

    // If already in a post-parse state (PARSED, MAPPING, MAPPED, VALIDATION_FAILED)
    // and the user triggers parse again (e.g. after Back navigation without re-uploading),
    // we allow it by temporarily setting status to UPLOADED first. This ensures parseFile
    // is always idempotent and safe for Back navigation recovery.
    const reparseableStates = [
      ImportStatus.PARSED,
      ImportStatus.MAPPING,
      ImportStatus.MAPPED,
      ImportStatus.VALIDATION_FAILED
    ];
    if (reparseableStates.includes(importItem.status)) {
      // Force-reset to UPLOADED so state machine allows UPLOADED → PARSING
      importItem.status = ImportStatus.UPLOADED;
      importItem.updatedAt = new Date();
    }

    if (ImportStateMachine.canTransition(importItem.status, ImportStatus.PARSING)) {
      ImportStateMachine.transition(importItem, ImportStatus.PARSING);
      await this.repository.update(importItem);
    }


    try {
      // 2. Read Stored Buffer
      const fileBuffer = await this.storage.readFile(importItem.fileStoragePath);

      // 3. Validate & Detect Format
      const validation = FileSecurityValidator.validate(
        importItem.fileName || 'file',
        fileBuffer,
        importItem.fileMimeType || undefined
      );

      // 4. Select Parser & Parse Content
      const parser = ParserFactory.getParser(validation.detectedFormat);
      const parsedDataset = await parser.parse(fileBuffer, options);

      // 5. Profile dataset and update Import Record
      const schema = importItem.targetEntity ? entitySchemaRegistry.getEntity(importItem.targetEntity) : undefined;
      const profiles = ColumnNormalizer.profileDataset(parsedDataset, schema?.fields);
      importItem.totalRecords = parsedDataset.rowCount;
      importItem.fileMetadata = {
        headers: parsedDataset.headers,
        normalizedHeaders: parsedDataset.normalizedHeaders,
        sampleRows: parsedDataset.rows.slice(0, 50).map((r) => r.values),
        rowCount: parsedDataset.rowCount,
        columnCount: parsedDataset.columnCount,
        format: parsedDataset.format,
        statistics: parsedDataset.statistics,
        warnings: parsedDataset.warnings,
        profiles
      };
      ImportStateMachine.transition(importItem, ImportStatus.PARSED);
      await this.repository.update(importItem);

      // 6. Record Audit Log
      await this.audit.recordEvent({
        organizationId: context.organizationId,
        importId: importItem.id,
        actorUserId: context.userId,
        action: 'FILE_PARSED',
        fromState: previousState,
        toState: ImportStatus.PARSED,
        details: {
          format: parsedDataset.format,
          rowCount: parsedDataset.rowCount,
          columnCount: parsedDataset.columnCount,
          headers: parsedDataset.headers,
          warnings: parsedDataset.warnings
        }
      });

      logger.info('File parsed successfully', {
        importId: importItem.id,
        organizationId: context.organizationId,
        format: parsedDataset.format,
        rowCount: parsedDataset.rowCount,
        columnCount: parsedDataset.columnCount
      });

      return parsedDataset;
    } catch (err) {
      // Record Failure Audit Log
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.audit.recordEvent({
        organizationId: context.organizationId,
        importId: importItem.id,
        actorUserId: context.userId,
        action: 'FILE_PARSE_FAILED',
        details: {
          error: errorMsg
        }
      });

      logger.error('File parsing failed', err instanceof Error ? err : new Error(errorMsg), {
        importId: importItem.id,
        organizationId: context.organizationId
      });

      // Try transition to FAILED or stay in previous state
      if (ImportStateMachine.canTransition(importItem.status, ImportStatus.FAILED)) {
        ImportStateMachine.transition(importItem, ImportStatus.FAILED);
        await this.repository.update(importItem);
      }

      if (err instanceof ValidationError || err instanceof ForbiddenError || err instanceof NotFoundError) {
        throw err;
      }

      throw new ValidationError(`File parsing failed: ${errorMsg}`);
    }
  }
}
