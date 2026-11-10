/**
 * Core Data Import Service
 * Orchestrates entity lifecycle, state machine transitions, tenant validation, and audit recording.
 */

import crypto from 'crypto';
import { DataImportEntity } from '../entities/data-import.entity.js';
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IAuditService } from './audit.service.interface.js';
import { IEntitySchemaRegistry, entitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { getModulesForRole, getModuleConfig, normalizeRoleCode } from '../../core/registry/module.registry.js';
import { ImportStateMachine } from '../state-machine/import-state-machine.js';
import {
  ImportStatus,
  ImportSourceType,
  ImportOptions,
  ImportFilterQuery,
  PaginatedResult,
  DuplicateStrategy,
  ErrorStrategy
} from '../../core/types/import.types.js';
import { SecurityContext, DataImportPermission, hasPermission } from '../../core/types/permissions.types.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError
} from '../../core/errors/import.errors.js';
import { logger } from '../../core/logging/structured-logger.js';

export interface CreateImportInput {
  name: string;
  targetModule?: string;
  targetEntity: string;
  sourceType?: ImportSourceType;
  sourceId?: string;
  importOptions?: Partial<ImportOptions>;
}

export interface UpdateImportInput {
  name?: string;
  targetModule?: string;
  targetEntity?: string;
  importOptions?: Partial<ImportOptions>;
}

export class ImportService {
  constructor(
    private readonly repository: IDataImportRepository,
    private readonly audit: IAuditService,
    private readonly schemaRegistry: IEntitySchemaRegistry = entitySchemaRegistry
  ) {}

  /**
   * Creates a new Data Import job in DRAFT state.
   */
  public async createImport(
    context: SecurityContext,
    input: CreateImportInput
  ): Promise<DataImportEntity> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_CREATE)) {
      throw new ForbiddenError('Missing DATA_IMPORT_CREATE permission');
    }

    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Import name is required');
    }

    if (!input.targetEntity) {
      throw new ValidationError('Target entity is required');
    }

    // Verify entity is registered in the schema registry
    const registered = this.schemaRegistry.getEntity(input.targetEntity);
    if (!registered) {
      throw new ValidationError(`Unknown target entity '${input.targetEntity}'. Entity must be registered in SchemaRegistry.`);
    }

    const id = crypto.randomUUID();
    const entity = new DataImportEntity({
      id,
      organizationId: context.organizationId,
      sourceId: input.sourceId,
      targetModule: input.targetModule || registered.module,
      targetEntity: input.targetEntity.toLowerCase(),
      name: input.name.trim(),
      status: ImportStatus.DRAFT,
      sourceType: input.sourceType || ImportSourceType.FILE_UPLOAD,
      importOptions: {
        duplicateStrategy: input.importOptions?.duplicateStrategy ?? DuplicateStrategy.SKIP,
        errorStrategy: input.importOptions?.errorStrategy ?? ErrorStrategy.CONTINUE_ON_ERROR,
        batchSize: input.importOptions?.batchSize ?? 500,
        skipHeaderRows: input.importOptions?.skipHeaderRows ?? 0,
        ...input.importOptions
      },
      requiresApproval: registered.approvalPolicy?.requiresApproval ?? false,
      createdBy: context.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    });

    const created = await this.repository.create(entity);

    await this.audit.recordEvent({
      organizationId: context.organizationId,
      importId: created.id,
      actorUserId: context.userId,
      action: 'IMPORT_CREATED',
      toState: ImportStatus.DRAFT,
      details: {
        name: created.name,
        targetModule: created.targetModule,
        targetEntity: created.targetEntity,
        sourceType: created.sourceType
      }
    });

    logger.info('Import created successfully', {
      importId: created.id,
      organizationId: context.organizationId,
      userId: context.userId
    });

    return created;
  }

  /**
   * Retrieves an import by ID ensuring tenant isolation.
   */
  public async getImport(
    context: SecurityContext,
    importId: string
  ): Promise<DataImportEntity> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
      throw new ForbiddenError('Missing DATA_IMPORT_VIEW permission');
    }

    const item = await this.repository.findById(context.organizationId, importId);
    if (!item) {
      throw new NotFoundError(`Import with ID '${importId}' was not found.`);
    }

    const userRoles = context.roles || [];
    const isCrossDeptAdmin = userRoles.some((r) => {
      const norm = normalizeRoleCode(r);
      return ['admin', 'superadmin', 'org_admin'].includes(norm);
    });
    if (!isCrossDeptAdmin) {
      const targetConfig = getModuleConfig(item.targetModule);
      const targetModuleId = targetConfig ? targetConfig.id.toLowerCase() : (item.targetModule || '').toLowerCase();
      const allowedModules = userRoles.flatMap((role) => getModulesForRole(role)).map((m) => m.id.toLowerCase());
      if (
        targetModuleId &&
        !allowedModules.includes(targetModuleId) &&
        !allowedModules.includes((item.targetModule || '').toLowerCase())
      ) {
        throw new ForbiddenError(`Department '${item.targetModule}' is not authorized for current user role(s)`);
      }
    }

    return item;
  }

  /**
   * Lists imports for the organization with pagination and filtering.
   */
  public async listImports(
    context: SecurityContext,
    query: ImportFilterQuery
  ): Promise<PaginatedResult<DataImportEntity>> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
      throw new ForbiddenError('Missing DATA_IMPORT_VIEW permission');
    }

    const result = await this.repository.findMany(context.organizationId, query);
    const userRoles = context.roles || [];
    const isCrossDeptAdmin = userRoles.some((r) => {
      const norm = normalizeRoleCode(r);
      return ['admin', 'superadmin', 'org_admin'].includes(norm);
    });
    if (isCrossDeptAdmin) {
      return result;
    }

    const allowedModules = userRoles.flatMap((role) => getModulesForRole(role)).map((m) => m.id.toLowerCase());
    const filteredData = result.data.filter((imp) => {
      const modConfig = getModuleConfig(imp.targetModule);
      const modId = modConfig ? modConfig.id.toLowerCase() : (imp.targetModule || '').toLowerCase();
      return !modId || allowedModules.includes(modId) || allowedModules.includes((imp.targetModule || '').toLowerCase());
    });

    return {
      ...result,
      data: filteredData,
      pagination: {
        ...result.pagination,
        total: filteredData.length,
        totalPages: Math.ceil(filteredData.length / (result.pagination.limit || 10))
      }
    };
  }

  /**
   * Updates an import draft or editable lifecycle state.
   */
  public async updateImport(
    context: SecurityContext,
    importId: string,
    input: UpdateImportInput
  ): Promise<DataImportEntity> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_CREATE)) {
      throw new ForbiddenError('Missing DATA_IMPORT_CREATE permission');
    }

    const item = await this.getImport(context, importId);

    if (!item.isEditable()) {
      throw new ConflictError(
        `Cannot edit import in '${item.status}' state. Only editable states (e.g. DRAFT, UPLOADED, MAPPING, VALIDATION_FAILED) permit modifications.`
      );
    }

    const oldValues = {
      name: item.name,
      targetEntity: item.targetEntity,
      importOptions: { ...item.importOptions }
    };

    if (input.name !== undefined) {
      if (input.name.trim().length === 0) {
        throw new ValidationError('Import name cannot be empty');
      }
      item.name = input.name.trim();
    }

    if (input.targetEntity !== undefined && input.targetEntity !== item.targetEntity) {
      const registered = this.schemaRegistry.getEntity(input.targetEntity);
      if (!registered) {
        throw new ValidationError(`Unknown target entity '${input.targetEntity}'`);
      }
      item.targetEntity = input.targetEntity.toLowerCase();
      item.targetModule = input.targetModule || registered.module;
      item.requiresApproval = registered.approvalPolicy?.requiresApproval ?? false;
    }

    if (input.importOptions) {
      item.importOptions = {
        ...item.importOptions,
        ...input.importOptions
      };
    }

    item.updatedAt = new Date();
    item.version += 1;

    const updated = await this.repository.update(item);

    await this.audit.recordEvent({
      organizationId: context.organizationId,
      importId: updated.id,
      actorUserId: context.userId,
      action: 'IMPORT_UPDATED',
      details: {
        previous: oldValues,
        current: {
          name: updated.name,
          targetEntity: updated.targetEntity,
          importOptions: updated.importOptions
        }
      }
    });

    return updated;
  }

  /**
   * Persists an in-progress import as a resumable DRAFT.
   */
  public async saveDraft(
    context: SecurityContext,
    importId: string,
    currentStep?: number
  ): Promise<DataImportEntity> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_CREATE)) {
      throw new ForbiddenError('Missing DATA_IMPORT_CREATE permission');
    }

    const item = await this.getImport(context, importId);
    if (!item.isEditable()) {
      throw new ConflictError(`Cannot save import in '${item.status}' state as a draft.`);
    }

    const previousState = item.status;
    if (item.status !== ImportStatus.DRAFT) {
      ImportStateMachine.transition(item, ImportStatus.DRAFT);
    }

    item.importOptions = {
      ...item.importOptions,
      customOptions: {
        ...(item.importOptions.customOptions || {}),
        savedWizardStep: currentStep || item.importOptions.customOptions?.savedWizardStep || 2,
        savedAsDraftAt: new Date().toISOString()
      }
    };
    item.updatedAt = new Date();
    const updated = await this.repository.update(item);

    await this.audit.recordEvent({
      organizationId: context.organizationId,
      importId,
      actorUserId: context.userId,
      action: 'IMPORT_SAVED_AS_DRAFT',
      fromState: previousState,
      toState: ImportStatus.DRAFT,
      details: { currentStep: currentStep || 2 }
    });

    return updated;
  }

  /**
   * Rollbacks changes of a given step from the backend.
   */
  public async revertStep(
    context: SecurityContext,
    importId: string,
    step: number
  ): Promise<void> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_CREATE)) {
      throw new ForbiddenError('Missing DATA_IMPORT_CREATE permission');
    }
    const item = await this.getImport(context, importId);
    if (!item.isEditable()) return;

    if (step === 2) {
      item.fileName = null;
      item.fileSizeBytes = null;
      item.fileMimeType = null;
      item.fileStoragePath = null;
      item.fileChecksumSha256 = null;
      item.fileMetadata = null;
      item.status = ImportStatus.DRAFT;
    } else if (step === 4) {
      item.status = ImportStatus.MAPPED;
      if (item.fileMetadata) {
        delete item.fileMetadata.validationSummary;
      }
    } else if (step === 5) {
      item.status = ImportStatus.VALIDATED;
      if (item.fileMetadata) {
        delete item.fileMetadata.duplicateSummary;
      }
    }

    item.updatedAt = new Date();
    await this.repository.update(item);

    await this.audit.recordEvent({
      organizationId: context.organizationId,
      importId,
      actorUserId: context.userId,
      action: 'IMPORT_UPDATED',
      details: { revertedStep: step }
    });
  }

  /**
   * Cancels an import job using the state machine.
   */
  public async cancelImport(
    context: SecurityContext,
    importId: string,
    reason?: string
  ): Promise<DataImportEntity> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_CANCEL)) {
      throw new ForbiddenError('Missing DATA_IMPORT_CANCEL permission');
    }

    const item = await this.getImport(context, importId);
    const previousState = item.status;

    // Apply state machine transition to CANCELLED
    ImportStateMachine.transition(item, ImportStatus.CANCELLED);

    const updated = await this.repository.update(item);

    await this.audit.recordEvent({
      organizationId: context.organizationId,
      importId: updated.id,
      actorUserId: context.userId,
      action: 'IMPORT_CANCELLED',
      fromState: previousState,
      toState: ImportStatus.CANCELLED,
      details: {
        reason: reason || 'Cancelled by user'
      }
    });

    logger.info('Import cancelled', {
      importId: updated.id,
      organizationId: context.organizationId,
      userId: context.userId,
      reason
    });

    return updated;
  }
}
