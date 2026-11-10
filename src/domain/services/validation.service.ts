/**
 * Validation Domain Service
 * Orchestrates multi-tier transformation and validation, staging persistence, and state transitions
 */

import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportMappingRepository } from '../repositories/data-import-mapping.repository.interface.js';
import {
  IDataImportRecordRepository,
  RecordFilterOptions
} from '../repositories/data-import-record.repository.interface.js';
import { IEntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { IAuditService } from '../services/audit.service.interface.js';
import { IFileStorageService, fileStorageService } from '../../infrastructure/storage/file-storage.service.js';
import { ParserFactory } from '../../infrastructure/parsers/parser.factory.js';
import { ImportStateMachine } from '../state-machine/import-state-machine.js';
import { ValidationEngine, validationEngine } from '../validation/validation.engine.js';
import { DataImportRecordEntity } from '../entities/data-import-record.entity.js';
import {
  SecurityContext,
  DataImportPermission,
  hasPermission
} from '../../core/types/permissions.types.js';
import { ImportStatus, PaginatedResult, RecordStatus } from '../../core/types/import.types.js';
import { ValidationSummary } from '../../core/types/validation.types.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError
} from '../../core/errors/import.errors.js';
import { ITargetMatchProviderRegistry } from '../duplicate/target-match-provider.interface.js';
import { logger } from '../../core/logging/structured-logger.js';

export class ValidationService {
  constructor(
    private readonly importRepository: IDataImportRepository,
    private readonly mappingRepository: IDataImportMappingRepository,
    private readonly recordRepository: IDataImportRecordRepository,
    private readonly schemaRegistry: IEntitySchemaRegistry,
    private readonly auditService: IAuditService,
    private readonly storage: IFileStorageService = fileStorageService,
    private readonly engine: ValidationEngine = validationEngine,
    private readonly targetProviderRegistry?: ITargetMatchProviderRegistry
  ) {}

  /**
   * Executes transformation and validation pipeline on all rows of an import job
   */
  public async validateImport(
    context: SecurityContext,
    importId: string
  ): Promise<ValidationSummary> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VALIDATE)) {
      throw new ForbiddenError('Insufficient permissions to validate import data');
    }

    const importJob = await this.importRepository.findById(context.organizationId, importId);
    if (!importJob) {
      throw new NotFoundError(`Import with ID '${importId}' not found`);
    }

    const allowedStates = [
      ImportStatus.MAPPED,
      ImportStatus.VALIDATING,
      ImportStatus.VALIDATED,
      ImportStatus.VALIDATION_FAILED
    ];

    if (!allowedStates.includes(importJob.status)) {
      throw new ConflictError(
        `Cannot validate import in state '${importJob.status}'. Import must be MAPPED before validation.`
      );
    }

    const mapping = await this.mappingRepository.findByImportId(context.organizationId, importId);
    if (!mapping) {
      throw new ValidationError(`No saved column mapping found for import '${importId}'`);
    }

    const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
    if (!schema) {
      throw new ValidationError(
        `Target entity '${importJob.targetEntity}' is not registered in Schema Registry`
      );
    }

    // 1. Transition state to VALIDATING
    if (importJob.status !== ImportStatus.VALIDATING) {
      ImportStateMachine.transition(importJob, ImportStatus.VALIDATING);
      await this.importRepository.update(importJob);
    }

    // 2. Load Raw Rows (from storage or cached metadata)
    let rawRows: Record<string, unknown>[] = [];
    if (importJob.fileStoragePath) {
      const buffer = await this.storage.readFile(importJob.fileStoragePath);
      const parser = ParserFactory.getParser(importJob.fileMetadata?.format || 'CSV');
      const parsed = await parser.parse(buffer);
      rawRows = parsed.rows.map((r) => r.values);
    } else if (importJob.fileMetadata?.sampleRows) {
      rawRows = importJob.fileMetadata.sampleRows;
    }

    // 3. Query Target Match Provider for existing database records (Level B uniqueness)
    const existingDbValuesByField: Record<string, Set<string>> = {};
    if (this.targetProviderRegistry) {
      const provider = this.targetProviderRegistry.getProvider(importJob.targetEntity);
      if (provider) {
        const uniqueFields = Object.entries(schema.fields).filter(([_, f]) => f.unique === true);
        for (const [fieldName] of uniqueFields) {
          const rawValuesSet = new Set<string>();
          for (const rawRow of rawRows) {
            const mappedCol = Object.keys(mapping.columnMappings || {}).find(
              (col) => mapping.columnMappings[col]?.targetField === fieldName
            );
            const sourceKey = mappedCol || fieldName;
            if (rawRow[sourceKey] !== undefined && rawRow[sourceKey] !== null) {
              const valStr = String(rawRow[sourceKey]).trim();
              if (valStr) rawValuesSet.add(valStr);
            }
          }
          const rawValues = Array.from(rawValuesSet);
          if (rawValues.length > 0) {
            try {
              const matchesMap = await provider.findByMatchKeys(
                context.organizationId,
                rawValues.map((v) => v.toUpperCase()),
                rawValues
              );
              const dbSet = new Set<string>();
              for (const [, matches] of matchesMap) {
                for (const match of matches) {
                  if (match.matchKey) {
                    dbSet.add(match.matchKey.toUpperCase());
                  }
                }
              }
              existingDbValuesByField[fieldName] = dbSet;
            } catch (err) {
              logger.warn(`Failed to query target provider for unique field '${fieldName}':`, { error: String(err) });
            }
          }
        }
      }
    }

    // 4. Execute Transformation Pipeline and Multi-Tier Validation
    const { summary, results } = this.engine.validateDataset(
      rawRows,
      mapping,
      schema,
      {
        organizationId: context.organizationId,
        importId
      },
      existingDbValuesByField
    );

    // 4. Stage validated records in Repository
    const recordEntities: DataImportRecordEntity[] = results.map(
      (r) =>
        new DataImportRecordEntity({
          id: crypto.randomUUID(),
          organizationId: context.organizationId,
          importId,
          rowIndex: r.rowIndex,
          rawData: r.rawData,
          transformedData: r.transformedData,
          transformationAudit: r.transformationAudit,
          status: r.status,
          validationErrors: r.issues.map((i) => ({
            field: i.field,
            code: i.code,
            message: i.message,
            severity: i.severity,
            sourceValue: i.sourceValue,
            details: i.details
          }))
        })
    );

    await this.recordRepository.deleteByImportId(context.organizationId, importId);
    await this.recordRepository.saveBatch(recordEntities);

    const detailedStats = this.computeDetailedQualityStats(results, schema, mapping);

    const transformationSummary: Record<string, number> = {};
    for (const result of results) {
      for (const entries of Object.values(result.transformationAudit || {})) {
        for (const entry of entries) transformationSummary[entry.type] = (transformationSummary[entry.type] || 0) + 1;
      }
    }

    // 5. Update Import job stats and state
    importJob.totalRecords = summary.totalRows;
    importJob.validRecords = summary.validRows;
    importJob.invalidRecords = summary.invalidRows;
    importJob.warningRecords = summary.warningRows;

    const fullSummary: ValidationSummary = {
      ...summary,
      correctedRows: detailedStats.correctedRows,
      duplicateRows: detailedStats.duplicateRows,
      rowsRequiringAction: detailedStats.rowsRequiringAction,
      errorGroups: detailedStats.errorGroups,
      columnStatistics: detailedStats.columnStatistics,
      correctionsSummary: detailedStats.correctionsSummary
    };

    // Persist the complete validation summary with the import job so the UI can
    // recover the exact backend source-of-truth after navigation, refresh, or
    // reopening a draft.
    importJob.fileMetadata = {
      ...(importJob.fileMetadata || {}),
      validationSummary: fullSummary,
      validationCompletedAt: new Date().toISOString()
    };

    const previousState = importJob.status;
    let nextState = ImportStatus.VALIDATED;

    if (summary.invalidRows > 0) {
      nextState = ImportStatus.VALIDATION_FAILED;
    }

    ImportStateMachine.transition(importJob, nextState);
    await this.importRepository.update(importJob);

    // 6. Record Audit Log
    await this.auditService.recordEvent({
      organizationId: context.organizationId,
      importId,
      actorUserId: context.userId,
      action: nextState === ImportStatus.VALIDATED ? 'IMPORT_VALIDATED' : 'IMPORT_VALIDATION_FAILED',
      fromState: previousState,
      toState: nextState,
      details: {
        totalRows: summary.totalRows,
        validRows: summary.validRows,
        invalidRows: summary.invalidRows,
        warningRows: summary.warningRows,
        errorCount: summary.errorCount,
        durationMs: summary.durationMs,
        automaticTransformations: transformationSummary
      }
    });

    logger.info('Import validation completed', {
      importId,
      status: nextState,
      validRows: summary.validRows,
      invalidRows: summary.invalidRows,
      durationMs: summary.durationMs
    });

    return fullSummary;
  }

  /**
   * Returns the authoritative validation snapshot for the import wizard.
   */
  public async getValidationSummary(
    context: SecurityContext,
    importId: string
  ): Promise<{
    status: ImportStatus;
    step: number;
    nextAllowedAction: string;
    canProceedToMatching: boolean;
    summary: ValidationSummary;
  }> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
      throw new ForbiddenError('Insufficient permissions to view validation summary');
    }

    const importJob = await this.importRepository.findById(context.organizationId, importId);
    if (!importJob) {
      throw new NotFoundError(`Import with ID '${importId}' not found`);
    }

    const persisted = importJob.fileMetadata?.validationSummary as Partial<ValidationSummary> | undefined;
    const hasPersistedValidation = persisted && typeof persisted.totalRows === 'number';
    const summary: ValidationSummary = {
      totalRows: Number(hasPersistedValidation ? persisted!.totalRows : (importJob.totalRecords || importJob.fileMetadata?.rowCount || 0)),
      validRows: Number(hasPersistedValidation ? (persisted!.validRows ?? 0) : (importJob.validRecords ?? 0)),
      invalidRows: Number(hasPersistedValidation ? (persisted!.invalidRows ?? 0) : (importJob.invalidRecords ?? 0)),
      warningRows: Number(hasPersistedValidation ? (persisted!.warningRows ?? 0) : (importJob.warningRecords ?? 0)),
      errorCount: Number(persisted?.errorCount ?? 0),
      warningCount: Number(persisted?.warningCount ?? 0),
      fieldIssueCounts: persisted?.fieldIssueCounts || {},
      issuesByCode: persisted?.issuesByCode || {},
      durationMs: Number(persisted?.durationMs ?? 0),
      correctedRows: Number(persisted?.correctedRows ?? 0),
      duplicateRows: Number(persisted?.duplicateRows ?? 0),
      rowsRequiringAction: Number(persisted?.rowsRequiringAction ?? (persisted?.invalidRows || 0)),
      errorGroups: persisted?.errorGroups || [],
      columnStatistics: persisted?.columnStatistics || [],
      correctionsSummary: persisted?.correctionsSummary || []
    };

    // Legacy/recovered jobs may have record rows but no persisted counters.
    if (summary.totalRows === 0) {
      const records = await this.recordRepository.countByStatus(context.organizationId, importId);
      summary.totalRows = Object.values(records).reduce((sum, count) => sum + Number(count || 0), 0);
      summary.validRows = Number(records[RecordStatus.VALID] || 0);
      summary.invalidRows = Number(records[RecordStatus.INVALID] || 0);
      summary.warningRows = Number(records[RecordStatus.WARNING] || 0);
    }

    const stepByStatus: Partial<Record<ImportStatus, number>> = {
      [ImportStatus.DRAFT]: 1,
      [ImportStatus.UPLOADED]: 2,
      [ImportStatus.PARSED]: 2,
      [ImportStatus.MAPPING]: 3,
      [ImportStatus.MAPPED]: 3,
      [ImportStatus.VALIDATING]: 4,
      [ImportStatus.VALIDATED]: 4,
      [ImportStatus.VALIDATION_FAILED]: 4,
      [ImportStatus.MATCHING]: 5,
      [ImportStatus.REQUIRES_APPROVAL]: 7,
      [ImportStatus.PENDING_APPROVAL]: 7,
      [ImportStatus.APPROVED]: 7,
      [ImportStatus.QUEUED]: 8,
      [ImportStatus.PROCESSING]: 8,
      [ImportStatus.COMPLETED]: 9,
      [ImportStatus.COMPLETED_WITH_ERRORS]: 9,
      [ImportStatus.RECONCILIATION_REQUIRED]: 9,
      [ImportStatus.FAILED]: 10,
      [ImportStatus.CANCELLED]: 10
    };

    const nextAllowedAction =
      importJob.status === ImportStatus.VALIDATED ? 'DUPLICATE_MATCHING' :
      importJob.status === ImportStatus.VALIDATION_FAILED ? 'CORRECT_INVALID_DATA' :
      importJob.status === ImportStatus.MAPPED ? 'RUN_VALIDATION' :
      importJob.status === ImportStatus.MAPPING ? 'SAVE_MAPPING' :
      'WAIT_FOR_CURRENT_OPERATION';

    return {
      status: importJob.status,
      step: stepByStatus[importJob.status] || 4,
      nextAllowedAction,
      canProceedToMatching: importJob.status === ImportStatus.VALIDATED,
      summary
    };
  }

  /**
   * Retrieves paginated preview of staged records with cell issues and status
   */
  public async getValidationPreview(
    context: SecurityContext,
    importId: string,
    options: RecordFilterOptions = {}
  ): Promise<PaginatedResult<DataImportRecordEntity>> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
      throw new ForbiddenError('Insufficient permissions to view validation preview');
    }

    const importJob = await this.importRepository.findById(context.organizationId, importId);
    if (!importJob) {
      throw new NotFoundError(`Import with ID '${importId}' not found`);
    }

    return this.recordRepository.findByImportId(context.organizationId, importId, options);
  }

  /**
   * Applies user record correction, re-transforms, re-validates, and updates staged record & import statistics
   */
  public async correctRecord(
    context: SecurityContext,
    importId: string,
    recordId: string,
    field: string,
    newValue: unknown
  ): Promise<{ record: DataImportRecordEntity; summary: ValidationSummary }> {
    return this.correctRecordFields(context, importId, recordId, { [field]: newValue });
  }

  public async correctRecordFields(
    context: SecurityContext,
    importId: string,
    recordId: string,
    fields: Record<string, unknown>
  ): Promise<{ record: DataImportRecordEntity; summary: ValidationSummary }> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VALIDATE)) {
      throw new ForbiddenError('Insufficient permissions to correct staged record data');
    }
    if (!fields || Object.keys(fields).length === 0) {
      throw new ValidationError('At least one field correction is required');
    }

    const importJob = await this.importRepository.findById(context.organizationId, importId);
    if (!importJob) {
      throw new NotFoundError(`Import with ID '${importId}' not found`);
    }

    const record = await this.recordRepository.findById(context.organizationId, recordId);
    if (!record || record.importId !== importId) {
      throw new NotFoundError(`Record '${recordId}' for import '${importId}' not found`);
    }
    const mapping = await this.mappingRepository.findByImportId(context.organizationId, importId);
    if (!mapping) {
      throw new ValidationError(`No saved column mapping found for import '${importId}'`);
    }

    const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
    if (!schema) {
      throw new ValidationError(`Target entity '${importJob.targetEntity}' is not registered`);
    }

    const updatedRawData = { ...record.rawData };
    const sourceColumns: Record<string, string> = {};
    const originalValues: Record<string, unknown> = {};
    for (const [field, newValue] of Object.entries(fields)) {
      const fieldDefinition = schema.fields[field];
      if (!fieldDefinition) {
        throw new ValidationError(`Field '${field}' is not part of entity '${importJob.targetEntity}'`);
      }
      if (fieldDefinition.readOnly) {
        throw new ValidationError(`Field '${field}' is read-only and cannot be corrected`);
      }

      // Map target field names back to uploaded source headers before re-transforming.
      const mappingDefinition = Object.entries(mapping.columnMappings || {})
        .find(([, definition]) => definition.targetField === field);
      const sourceColumn = mappingDefinition?.[0] || field;
      sourceColumns[field] = sourceColumn;
      originalValues[field] = record.rawData[sourceColumn];
      updatedRawData[sourceColumn] = typeof newValue === 'string' ? newValue.trim() : newValue;
    }

    record.rawData = updatedRawData;

    // 2. Re-transform row
    const transformResult = this.engine['pipeline'].transformRow(
      record.rowIndex,
      updatedRawData,
      mapping,
      schema,
      { organizationId: context.organizationId, importId }
    );

    // 3. Re-validate row
    const validationResult = this.engine.validateRow(
      record.rowIndex,
      updatedRawData,
      transformResult.transformedData,
      transformResult.transformationErrors,
      schema,
      { organizationId: context.organizationId, importId }
    );

    // 4. Update Record entity properties
    record.transformedData = validationResult.transformedData;
    record.transformationAudit = transformResult.transformationAudit;
    record.status = validationResult.status;
    record.validationErrors = validationResult.issues.map((i) => ({
      field: i.field,
      code: i.code,
      message: i.message,
      severity: i.severity,
      sourceValue: i.sourceValue,
      details: i.details
    }));
    if (record.status !== RecordStatus.INVALID && !record.validationErrors.some(e => String(e.severity || 'ERROR').toUpperCase() === 'ERROR')) {
      if (record.blockedReason === 'Validation errors present' || String(record.executionReason || '').includes('validation errors')) {
        record.blockedReason = null;
        record.executionReason = 'Record validated successfully';
        record.isBlocked = false;
        if (record.executionAction === 'BLOCKED' as any) {
          record.executionAction = 'CREATE' as any;
        }
      }
    }
    record.updatedAt = new Date();

    await this.recordRepository.saveBatch([record]);

    // Re-evaluate dataset-wide uniqueness rules on all records after cell correction
    const allRefreshed = await this.recordRepository.findByImportId(
      context.organizationId,
      importId,
      { limit: 100000 }
    );

    const datasetResults = allRefreshed.data.map(r => ({
      rowIndex: r.rowIndex,
      status: r.status,
      rawData: r.rawData,
      transformedData: r.transformedData || {},
      issues: r.validationErrors || [],
      isValid: r.status === RecordStatus.VALID,
      hasWarnings: r.status === RecordStatus.WARNING
    }));

    // Uniqueness validation is performed in Step 5 (Duplicate Detection & Matching)
    // this.engine.applyUniquenessValidation(datasetResults, schema);

    const revalidatedToSave: DataImportRecordEntity[] = [];
    for (let i = 0; i < allRefreshed.data.length; i++) {
      const orig = allRefreshed.data[i];
      const updated = datasetResults[i];
      if (
        updated.status !== orig.status ||
        JSON.stringify(updated.issues) !== JSON.stringify(orig.validationErrors || [])
      ) {
        orig.status = updated.status;
        orig.validationErrors = updated.issues;
        orig.updatedAt = new Date();
        revalidatedToSave.push(orig);
      }
    }
    if (revalidatedToSave.length > 0) {
      await this.recordRepository.saveBatch(revalidatedToSave);
    }

    // 5. Recalculate dataset metrics from repository aggregates.
    const statusCounts = await this.recordRepository.countByStatus(context.organizationId, importId);
    const totalRows = Object.values(statusCounts).reduce((sum, count) => sum + Number(count || 0), 0);
    const validRows = Number(statusCounts[RecordStatus.VALID] || 0);
    const warningRows = Number(statusCounts[RecordStatus.WARNING] || 0);
    const invalidRows = Number(statusCounts[RecordStatus.INVALID] || 0);

    importJob.totalRecords = totalRows;
    importJob.validRecords = validRows;
    importJob.invalidRecords = invalidRows;
    importJob.warningRecords = warningRows;

    const previousState = importJob.status;
    const nextState = invalidRows === 0 ? ImportStatus.VALIDATED : ImportStatus.VALIDATION_FAILED;
    if (importJob.status !== nextState) {
      ImportStateMachine.transition(importJob, nextState);
    }
    importJob.updatedAt = new Date();

    await this.importRepository.update(importJob);

    // 6. Record Audit Event
    await this.auditService.recordEvent({
      organizationId: context.organizationId,
      importId,
      actorUserId: context.userId,
      action: 'RECORD_CORRECTED',
      fromState: previousState,
      toState: nextState,
      details: {
        recordId,
        rowIndex: record.rowIndex,
        correctedFields: Object.keys(fields),
        sourceColumns,
        originalValues,
        editedValues: Object.fromEntries(Object.keys(fields).map((field) => [
          field,
          record.transformedData?.[field] ?? fields[field]
        ])),
        ...(Object.keys(fields).length === 1
          ? {
              correctedField: Object.keys(fields)[0],
              sourceColumn: sourceColumns[Object.keys(fields)[0]],
              newValue: fields[Object.keys(fields)[0]]
            }
          : {}),
        newStatus: record.status,
        remainingInvalidRows: invalidRows
      }
    });

    const fieldIssueCounts: Record<string, number> = {};
    const issuesByCode: Record<string, number> = {};
    let errorCount = 0;
    let warningCount = 0;

    for (const r of allRefreshed.data) {
      for (const err of r.validationErrors) {
        if (err.severity === 'ERROR') errorCount++;
        if (err.severity === 'WARNING') warningCount++;
        if (err.field) fieldIssueCounts[err.field] = (fieldIssueCounts[err.field] || 0) + 1;
        if (err.code) issuesByCode[err.code] = (issuesByCode[err.code] || 0) + 1;
      }
    }

    const previousSnapshot = importJob.fileMetadata?.validationSummary as Partial<ValidationSummary> | undefined;
    const summary: ValidationSummary = {
      totalRows,
      validRows,
      invalidRows,
      warningRows,
      errorCount,
      warningCount,
      fieldIssueCounts,
      issuesByCode,
      durationMs: 0,
      correctedRows: Number(previousSnapshot?.correctedRows || 0) + 1
    };

    importJob.fileMetadata = {
      ...(importJob.fileMetadata || {}),
      validationSummary: summary,
      validationCompletedAt: new Date().toISOString()
    };
    await this.importRepository.update(importJob);

    return { record, summary };
  }

  /**
   * Applies bulk correction to all staged records matching a target field and error/value condition
   */
  public async bulkCorrectRecords(
    context: SecurityContext,
    importId: string,
    field: string,
    oldValue: unknown,
    newValue: unknown,
    errorCode?: string
  ): Promise<{ correctedCount: number; summary: ValidationSummary }> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VALIDATE)) {
      throw new ForbiddenError('Insufficient permissions to correct staged record data');
    }

    const importJob = await this.importRepository.findById(context.organizationId, importId);
    if (!importJob) {
      throw new NotFoundError(`Import with ID '${importId}' not found`);
    }

    const mapping = await this.mappingRepository.findByImportId(context.organizationId, importId);
    if (!mapping) {
      throw new ValidationError(`No saved column mapping found for import '${importId}'`);
    }

    const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
    if (!schema) {
      throw new ValidationError(`Target entity '${importJob.targetEntity}' is not registered`);
    }

    const mappingDefinition = Object.entries(mapping.columnMappings || {})
      .find(([, definition]) => definition.targetField === field);
    const sourceColumn = mappingDefinition?.[0] || field;

    const stagedRecords = await this.recordRepository.findByImportId(
      context.organizationId,
      importId,
      { limit: 100000 }
    );

    const recordsToUpdate: DataImportRecordEntity[] = [];

    for (const record of stagedRecords.data) {
      let isMatch = false;
      const hasFieldIssue = record.validationErrors?.some((e) => e.field === field);

      if (hasFieldIssue) {
        if (errorCode) {
          if (record.validationErrors.some((e) => e.field === field && e.code === errorCode)) {
            isMatch = true;
          }
        } else if (oldValue !== undefined) {
          const rawVal = record.rawData?.[sourceColumn];
          if (String(rawVal ?? '').trim() === String(oldValue ?? '').trim()) {
            isMatch = true;
          }
        } else {
          isMatch = true;
        }
      }

      if (isMatch) {
        const updatedRawData = { ...record.rawData, [sourceColumn]: newValue };
        record.rawData = updatedRawData;

        const transformResult = this.engine['pipeline'].transformRow(
          record.rowIndex,
          updatedRawData,
          mapping,
          schema,
          { organizationId: context.organizationId, importId }
        );

        const validationResult = this.engine.validateRow(
          record.rowIndex,
          updatedRawData,
          transformResult.transformedData,
          transformResult.transformationErrors,
          schema,
          { organizationId: context.organizationId, importId }
        );

        record.transformedData = validationResult.transformedData;
        record.transformationAudit = transformResult.transformationAudit;
        record.status = validationResult.status;
        record.validationErrors = validationResult.issues.map((i) => ({
          field: i.field,
          code: i.code,
          message: i.message,
          severity: i.severity,
          sourceValue: i.sourceValue,
          details: i.details
        }));
        record.updatedAt = new Date();
        recordsToUpdate.push(record);
      }
    }

    if (recordsToUpdate.length > 0) {
      await this.recordRepository.saveBatch(recordsToUpdate);
    }

    const allRefreshed = await this.recordRepository.findByImportId(
      context.organizationId,
      importId,
      { limit: 100000 }
    );

    const datasetResults = allRefreshed.data.map(r => ({
      rowIndex: r.rowIndex,
      status: r.status,
      rawData: r.rawData,
      transformedData: r.transformedData || {},
      issues: r.validationErrors || [],
      isValid: r.status === RecordStatus.VALID,
      hasWarnings: r.status === RecordStatus.WARNING
    }));

    // Uniqueness validation is performed in Step 5 (Duplicate Detection & Matching)
    // this.engine.applyUniquenessValidation(datasetResults, schema);

    const revalidatedToSave: DataImportRecordEntity[] = [];
    for (let i = 0; i < allRefreshed.data.length; i++) {
      const orig = allRefreshed.data[i];
      const updated = datasetResults[i];
      if (
        updated.status !== orig.status ||
        JSON.stringify(updated.issues) !== JSON.stringify(orig.validationErrors || [])
      ) {
        orig.status = updated.status;
        orig.validationErrors = updated.issues;
        orig.updatedAt = new Date();
        revalidatedToSave.push(orig);
      }
    }
    if (revalidatedToSave.length > 0) {
      await this.recordRepository.saveBatch(revalidatedToSave);
    }

    const detailedStats = this.computeDetailedQualityStats(
      allRefreshed.data.map((r) => ({
        rowIndex: r.rowIndex,
        status: r.status,
        rawData: r.rawData,
        transformedData: r.transformedData,
        issues: r.validationErrors,
        transformationAudit: r.transformationAudit
      })),
      schema,
      mapping
    );

    const statusCounts = await this.recordRepository.countByStatus(context.organizationId, importId);
    const totalRows = Object.values(statusCounts).reduce((sum, count) => sum + Number(count || 0), 0);
    const validRows = Number(statusCounts[RecordStatus.VALID] || 0);
    const warningRows = Number(statusCounts[RecordStatus.WARNING] || 0);
    const invalidRows = Number(statusCounts[RecordStatus.INVALID] || 0);

    importJob.totalRecords = totalRows;
    importJob.validRecords = validRows;
    importJob.invalidRecords = invalidRows;
    importJob.warningRecords = warningRows;

    const previousState = importJob.status;
    const nextState = invalidRows === 0 ? ImportStatus.VALIDATED : ImportStatus.VALIDATION_FAILED;
    if (importJob.status !== nextState) {
      ImportStateMachine.transition(importJob, nextState);
    }
    importJob.updatedAt = new Date();

    const summary: ValidationSummary = {
      totalRows,
      validRows,
      invalidRows,
      warningRows,
      errorCount: allRefreshed.data.reduce((acc, r) => acc + (r.validationErrors?.filter(e => e.severity === 'ERROR').length || 0), 0),
      warningCount: allRefreshed.data.reduce((acc, r) => acc + (r.validationErrors?.filter(e => e.severity === 'WARNING').length || 0), 0),
      fieldIssueCounts: detailedStats.columnStatistics.reduce((acc, c) => ({ ...acc, [c.field]: c.invalid }), {}),
      issuesByCode: detailedStats.errorGroups.reduce((acc, g) => ({ ...acc, [g.code]: g.count }), {}),
      durationMs: 0,
      correctedRows: detailedStats.correctedRows,
      duplicateRows: detailedStats.duplicateRows,
      rowsRequiringAction: detailedStats.rowsRequiringAction,
      errorGroups: detailedStats.errorGroups,
      columnStatistics: detailedStats.columnStatistics,
      correctionsSummary: detailedStats.correctionsSummary
    };

    importJob.fileMetadata = {
      ...(importJob.fileMetadata || {}),
      validationSummary: summary,
      validationCompletedAt: new Date().toISOString()
    };
    await this.importRepository.update(importJob);

    await this.auditService.recordEvent({
      organizationId: context.organizationId,
      importId,
      actorUserId: context.userId,
      action: 'BULK_RECORDS_CORRECTED',
      fromState: previousState,
      toState: nextState,
      details: {
        field,
        oldValue,
        newValue,
        errorCode,
        correctedCount: recordsToUpdate.length,
        remainingInvalidRows: invalidRows
      }
    });

    return { correctedCount: recordsToUpdate.length, summary };
  }

  private computeDetailedQualityStats(
    results: Array<{
      rowIndex: number;
      status: RecordStatus;
      rawData: Record<string, unknown>;
      transformedData?: Record<string, unknown> | null;
      issues: Array<{ field?: string; code?: string; severity?: string; message?: string; sourceValue?: unknown }>;
      transformationAudit?: Record<string, any>;
    }>,
    schema?: any,
    mapping?: any
  ) {
    let duplicateRows = 0;
    let rowsRequiringAction = 0;

    const errorGroupsMap = new Map<string, {
      code: string;
      name: string;
      count: number;
      severity: any;
      affectedColumns: Set<string>;
      examples: Set<string>;
    }>();

    const columnStatsMap = new Map<string, {
      field: string;
      label?: string;
      type: string;
      total: number;
      valid: number;
      invalid: number;
      empty: number;
      duplicate: number;
    }>();

    if (schema?.fields) {
      for (const [fieldKey, fieldDef] of Object.entries(schema.fields as Record<string, any>)) {
        columnStatsMap.set(fieldKey, {
          field: fieldKey,
          label: fieldDef.label || fieldKey,
          type: fieldDef.type || 'STRING',
          total: 0,
          valid: 0,
          invalid: 0,
          empty: 0,
          duplicate: 0
        });
      }
    }

    const correctionsMap = new Map<string, {
      column: string;
      originalValue: string;
      correctedValue: string;
      reason: string;
      count: number;
    }>();

    let correctedRowsCount = 0;

    for (const r of results) {
      const isInvalid = r.status === RecordStatus.INVALID;
      const isWarning = r.status === RecordStatus.WARNING;
      const hasIssues = (r.issues && r.issues.length > 0);

      let isDup = false;
      for (const issue of r.issues || []) {
        if (issue.code?.includes('DUP') || issue.code?.includes('DUPLICATE')) {
          isDup = true;
          break;
        }
      }
      if (isDup) duplicateRows++;

      if (isInvalid || isWarning || hasIssues) {
        rowsRequiringAction++;
      }

      let rowHasTransform = false;
      if (r.transformationAudit) {
        for (const [col, entries] of Object.entries(r.transformationAudit)) {
          for (const entry of entries) {
            rowHasTransform = true;
            const orig = String(entry.from ?? '');
            const corr = String(entry.to ?? '');
            const key = `${col}|${orig}|${corr}`;
            const existing = correctionsMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              correctionsMap.set(key, {
                column: col,
                originalValue: orig,
                correctedValue: corr,
                reason: entry.type || entry.reason || 'Auto transformation',
                count: 1
              });
            }
          }
        }
      }
      if (rowHasTransform) correctedRowsCount++;

      const rowFailedFields = new Set<string>();

      for (const issue of r.issues || []) {
        const code = issue.code || 'VALIDATION_ERROR';
        const field = issue.field || '';
        if (field) rowFailedFields.add(field);

        let groupName = code;
        if (code === 'MISSING_REQUIRED_FIELD' || code === 'REQUIRED_FIELD_MISSING') groupName = 'Missing Required Field';
        else if (code === 'INVALID_EMAIL' || code === 'INVALID_EMAIL_FORMAT') groupName = 'Invalid Email Format';
        else if (code === 'INVALID_DATE' || code === 'INVALID_DATE_FORMAT') groupName = 'Invalid Date Format';
        else if (code === 'INVALID_ENUM' || code === 'INVALID_ENUM_VALUE') groupName = 'Invalid Enum Value';
        else if (code === 'INVALID_NUMBER' || code === 'INVALID_INTEGER' || code === 'INVALID_DECIMAL') groupName = 'Invalid Number Format';
        else if (code === 'DUPLICATE_KEY_IN_FILE' || code === 'DUPLICATE_IN_FILE' || code === 'DUPLICATE_KEY') {
          const fieldLabel = field && schema?.fields?.[field]?.label ? schema.fields[field].label : field;
          groupName = fieldLabel ? `Duplicate ${fieldLabel} (In File)` : 'Duplicate Record (In File)';
        }
        else if (code === 'DUPLICATE_KEY_IN_DATABASE' || code === 'DUPLICATE_IN_TARGET') {
          const fieldLabel = field && schema?.fields?.[field]?.label ? schema.fields[field].label : field;
          groupName = fieldLabel ? `Duplicate ${fieldLabel} (Existing Database Record)` : 'Duplicate Record (Existing Database Record)';
        }

        const groupKey = field ? `${code}:${field}` : code;
        let group = errorGroupsMap.get(groupKey);
        if (!group) {
          group = {
            code,
            name: groupName,
            count: 0,
            severity: issue.severity || 'ERROR',
            affectedColumns: new Set<string>(),
            examples: new Set<string>()
          };
          errorGroupsMap.set(groupKey, group);
        }
        group.count++;
        if (field) group.affectedColumns.add(field);
        const exVal = issue.sourceValue != null ? String(issue.sourceValue) : (field ? String(r.rawData[field] ?? '') : '');
        if (exVal && group.examples.size < 5) group.examples.add(exVal);
      }

      for (const [fieldKey, stat] of columnStatsMap.entries()) {
        stat.total++;
        const val = r.rawData[fieldKey] ?? r.transformedData?.[fieldKey];
        if (val === null || val === undefined || val === '') {
          stat.empty++;
        }
        if (rowFailedFields.has(fieldKey)) {
          stat.invalid++;
        } else {
          stat.valid++;
        }
        if (isDup) stat.duplicate++;
      }
    }

    const errorGroups = Array.from(errorGroupsMap.values()).map(g => ({
      ...g,
      affectedColumns: Array.from(g.affectedColumns),
      examples: Array.from(g.examples)
    }));

    const columnStatistics = Array.from(columnStatsMap.values());
    const correctionsSummary = Array.from(correctionsMap.values());

    return {
      duplicateRows,
      rowsRequiringAction,
      correctedRows: correctedRowsCount,
      errorGroups,
      columnStatistics,
      correctionsSummary
    };
  }
}
