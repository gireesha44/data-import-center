/**
 * Post-Execution Reconciliation Domain Service
 */

import { randomUUID } from 'node:crypto';
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { IDataImportExecutionRepository } from '../repositories/data-import-execution.repository.interface.js';
import { IDataImportReconciliationRepository } from '../repositories/data-import-reconciliation.repository.interface.js';
import { DataImportReconciliationEntity } from '../entities/data-import-reconciliation.entity.js';
import { ImportStateMachine } from '../state-machine/import-state-machine.js';
import {
  ImportStatus,
  RecordStatus,
  ExecutionStatus
} from '../../core/types/import.types.js';
import { ExecutionIntentAction } from '../../core/types/duplicate.types.js';
import {
  ReconciliationStatus,
  ReconciliationMismatchType,
  ReconciliationMismatch,
  ReconciliationResult
} from '../../core/types/reconciliation.types.js';
import {
  SecurityContext,
  hasPermission,
  DataImportPermission
} from '../../core/types/permissions.types.js';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError
} from '../../core/errors/import.errors.js';
import { auditService } from '../../infrastructure/services/audit.service.js';
import { IAuditService } from './audit.service.interface.js';
import { StructuredLogger, logger as defaultLogger } from '../../core/logging/structured-logger.js';
import { MetricsService, metricsService as defaultMetrics } from './metrics.service.js';

export class ReconciliationService {
  constructor(
    private readonly importRepository: IDataImportRepository,
    private readonly recordRepository: IDataImportRecordRepository,
    private readonly executionRepository: IDataImportExecutionRepository,
    private readonly reconciliationRepository: IDataImportReconciliationRepository,
    private readonly auditServiceInstance: IAuditService = auditService,
    private readonly logger: StructuredLogger = defaultLogger,
    private readonly metrics: MetricsService = defaultMetrics
  ) {}

  /**
   * Reconciles intended execution actions against actual staged record outcomes
   */
  public async reconcileImport(
    context: SecurityContext,
    importId: string
  ): Promise<ReconciliationResult> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
      throw new ForbiddenError('Insufficient permissions to reconcile import');
    }

    const startTime = Date.now();
    const importJob = await this.importRepository.findById(context.organizationId, importId);
    if (!importJob) {
      throw new NotFoundError(`Import job with ID '${importId}' not found`);
    }

    const latestExecution = await this.executionRepository.findByImportId(
      context.organizationId,
      importId
    );

    const stagedRecords = await this.recordRepository.findByImportId(
      context.organizationId,
      importId,
      { limit: 100000 }
    );

    const sourceRows = Number(importJob.totalRecords || importJob.fileMetadata?.rowCount || stagedRecords.pagination.total || 0);
    const sourceColumns = Number(importJob.fileMetadata?.columnCount || importJob.fileMetadata?.headers?.length || 0);
    let validatedRows = 0;
    let invalidRows = 0;
    let warningRows = 0;
    let correctedRows = 0;
    let duplicateRows = 0;

    const mismatches: ReconciliationMismatch[] = [];
    let plannedRecords = 0;
    let attemptedRecords = 0;
    let createdRecords = 0;
    let updatedRecords = 0;
    let skippedRecords = 0;
    let rejectedRecords = 0;
    let blockedRecords = 0;
    let failedRecords = 0;

    for (const record of stagedRecords.data) {
      const action = record.executionAction || ExecutionIntentAction.BLOCKED;
      const status = record.status;
      if (status === RecordStatus.VALID || status === RecordStatus.CREATED || status === RecordStatus.UPDATED) validatedRows++;
      else if (status === RecordStatus.INVALID || status === RecordStatus.REJECTED) invalidRows++;
      else if (status === RecordStatus.WARNING) warningRows++;
      if (record.transformationAudit && Object.keys(record.transformationAudit).length > 0) correctedRows++;
      if (record.isDuplicate || record.matchClassification === 'DUPLICATE_IN_FILE') duplicateRows++;
      plannedRecords++;

      if (status === RecordStatus.CREATED) createdRecords++;
      else if (status === RecordStatus.UPDATED) updatedRecords++;
      else if (status === RecordStatus.SKIPPED || status === RecordStatus.SKIPPED_DUPLICATE) skippedRecords++;
      else if (status === RecordStatus.REJECTED && action === ExecutionIntentAction.REJECT) rejectedRecords++;
      else if (status === RecordStatus.REJECTED || status === RecordStatus.INVALID) blockedRecords++;
      else if (status === RecordStatus.FAILED) failedRecords++;

      if (status === RecordStatus.CREATED || status === RecordStatus.UPDATED || status === RecordStatus.FAILED) {
        attemptedRecords++;
      }

      // Evaluate Intended vs Actual agreement
      switch (action) {
        case ExecutionIntentAction.CREATE:
          if (status === RecordStatus.FAILED) {
            // Failed execution is a failure
          } else if (status !== RecordStatus.CREATED) {
            mismatches.push({
              recordId: record.id,
              rowIndex: record.rowIndex,
              type: ReconciliationMismatchType.INTENT_RESULT_MISMATCH,
              plannedAction: action,
              actualStatus: status,
              message: `Record was planned for CREATE but resulted in status '${status}'`,
              severity: 'ERROR'
            });
          }
          break;

        case ExecutionIntentAction.UPDATE:
          if (status === RecordStatus.FAILED) {
            // Failed execution
          } else if (status !== RecordStatus.UPDATED) {
            mismatches.push({
              recordId: record.id,
              rowIndex: record.rowIndex,
              type: ReconciliationMismatchType.INTENT_RESULT_MISMATCH,
              plannedAction: action,
              actualStatus: status,
              message: `Record was planned for UPDATE but resulted in status '${status}'`,
              severity: 'ERROR'
            });
          }
          break;

        case ExecutionIntentAction.SKIP:
          if (status !== RecordStatus.SKIPPED && status !== RecordStatus.SKIPPED_DUPLICATE && status !== RecordStatus.VALID) {
            mismatches.push({
              recordId: record.id,
              rowIndex: record.rowIndex,
              type: ReconciliationMismatchType.INTENT_RESULT_MISMATCH,
              plannedAction: action,
              actualStatus: status,
              message: `Record was planned for SKIP but resulted in status '${status}'`,
              severity: 'WARNING'
            });
          }
          break;

        case ExecutionIntentAction.REJECT:
          if (status !== RecordStatus.REJECTED) {
            mismatches.push({
              recordId: record.id,
              rowIndex: record.rowIndex,
              type: ReconciliationMismatchType.INTENT_RESULT_MISMATCH,
              plannedAction: action,
              actualStatus: status,
              message: `Record was planned for REJECT but resulted in status '${status}'`,
              severity: 'WARNING'
            });
          }
          break;

        case ExecutionIntentAction.BLOCKED:
          if (status !== RecordStatus.REJECTED && status !== RecordStatus.INVALID) {
            mismatches.push({
              recordId: record.id,
              rowIndex: record.rowIndex,
              type: ReconciliationMismatchType.INTENT_RESULT_MISMATCH,
              plannedAction: action,
              actualStatus: status,
              message: `Record was planned for BLOCKED but resulted in status '${status}'`,
              severity: 'WARNING'
            });
          }
          break;
      }
    }

    const successfulRecords = createdRecords + updatedRecords + skippedRecords + rejectedRecords + blockedRecords;
    const varianceCount = Math.abs(sourceRows - (
      createdRecords + updatedRecords + skippedRecords + rejectedRecords + blockedRecords + failedRecords
    ));
    const durationMs = Date.now() - startTime;

    // Determine Reconciliation Status
    let reconciliationStatus: ReconciliationStatus;
    if (mismatches.length > 0 || varianceCount > 0) {
      reconciliationStatus = ReconciliationStatus.MISMATCHED;
    } else if (failedRecords > 0) {
      reconciliationStatus = ReconciliationStatus.PARTIALLY_RECONCILED;
    } else {
      reconciliationStatus = ReconciliationStatus.FULLY_RECONCILED;
    }

    const executionId = latestExecution?.id || `exec_synth_${randomUUID()}`;

    // Persist Reconciliation Entity
    const entity = new DataImportReconciliationEntity({
      id: `rec_${randomUUID()}`,
      organizationId: context.organizationId,
      importId,
      executionId,
      plannedRecords,
      attemptedRecords,
      successfulRecords,
      createdRecords,
      updatedRecords,
      skippedRecords,
      rejectedRecords,
      blockedRecords,
      failedRecords,
      varianceCount,
      mismatchCount: mismatches.length,
      mismatches,
      status: reconciliationStatus,
      reconciledAt: new Date(),
      durationMs
    });

    await this.reconciliationRepository.create(entity);

    // Transition Import State Machine to Final Status
    if (reconciliationStatus === ReconciliationStatus.FULLY_RECONCILED) {
      if (ImportStateMachine.canTransition(importJob.status, ImportStatus.COMPLETED)) {
        ImportStateMachine.transition(importJob, ImportStatus.COMPLETED);
      }
    } else if (reconciliationStatus === ReconciliationStatus.PARTIALLY_RECONCILED) {
      if (ImportStateMachine.canTransition(importJob.status, ImportStatus.COMPLETED_WITH_ERRORS)) {
        ImportStateMachine.transition(importJob, ImportStatus.COMPLETED_WITH_ERRORS);
      }
    } else if (reconciliationStatus === ReconciliationStatus.MISMATCHED) {
      if (ImportStateMachine.canTransition(importJob.status, ImportStatus.RECONCILIATION_REQUIRED)) {
        ImportStateMachine.transition(importJob, ImportStatus.RECONCILIATION_REQUIRED);
      }
    }
    await this.importRepository.update(importJob);

    // Metrics & Audit Logging
    this.metrics.increment('imports_reconciled_total', 1, { status: reconciliationStatus });
    this.metrics.recordDuration('reconciliation_duration_ms', durationMs);

    await this.auditServiceInstance.recordEvent({
      organizationId: context.organizationId,
      importId,
      actorUserId: context.userId,
      action: 'IMPORT_RECONCILED',
      details: {
        reconciliationId: entity.id,
        status: reconciliationStatus,
        failedRecords,
        rejectedRecords,
        varianceCount,
        mismatchCount: mismatches.length,
        durationMs
      }
    });

    this.logger.info('Import reconciliation completed', {
      importId,
      status: reconciliationStatus,
      successfulRecords,
      failedRecords,
      mismatchCount: mismatches.length,
      durationMs
    });

    return {
      importId,
      sourceRows,
      sourceColumns,
      validatedRows,
      invalidRows,
      warningRows,
      correctedRows,
      duplicateRows,
      executionId,
      plannedRecords,
      attemptedRecords,
      successfulRecords,
      createdRecords,
      updatedRecords,
      skippedRecords,
      rejectedRecords,
      blockedRecords,
      failedRecords,
      varianceCount,
      mismatchCount: mismatches.length,
      mismatches,
      status: reconciliationStatus,
      reconciledAt: entity.reconciledAt,
      durationMs
    };
  }

  /**
   * Retrieves latest reconciliation result for an import job
   */
  public async getLatestReconciliation(
    organizationId: string,
    importId: string
  ): Promise<DataImportReconciliationEntity | null> {
    return this.reconciliationRepository.findByImportId(organizationId, importId);
  }
}
