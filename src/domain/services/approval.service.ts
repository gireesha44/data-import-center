/**
 * Data Import Approval Domain Service
 */

import { createHash, randomUUID } from 'node:crypto';
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportApprovalRepository } from '../repositories/data-import-approval.repository.interface.js';
import { IDataImportMappingRepository } from '../repositories/data-import-mapping.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { entitySchemaRegistry, EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { getModulesForRole, getModuleConfig, normalizeRoleCode } from '../../core/registry/module.registry.js';
import { auditService } from '../../infrastructure/services/audit.service.js';
import { IAuditService } from './audit.service.interface.js';
import { inMemoryDataImportApprovalRepository } from '../../infrastructure/repositories/in-memory-data-import-approval.repository.js';
import { StructuredLogger } from '../../core/logging/structured-logger.js';
import { SecurityContext, DataImportPermission, hasPermission } from '../../core/types/permissions.types.js';
import { DataImportApprovalEntity } from '../entities/data-import-approval.entity.js';
import { ApprovalStatus, ImportStatus, DuplicateStrategy, RecordStatus } from '../../core/types/import.types.js';
import { ExecutionIntentAction, MatchClassification } from '../../core/types/duplicate.types.js';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError
} from '../../core/errors/import.errors.js';
import { ImportStateMachine } from '../state-machine/import-state-machine.js';

export class ApprovalService {
  private importRepository: IDataImportRepository;
  private approvalRepository: IDataImportApprovalRepository;
  private mappingRepository: IDataImportMappingRepository;
  private recordRepository: IDataImportRecordRepository;
  private schemaRegistry: EntitySchemaRegistry;
  private auditService: IAuditService;
  private logger: StructuredLogger;

  constructor(
    importRepository: IDataImportRepository,
    mappingRepository: IDataImportMappingRepository,
    recordRepository: IDataImportRecordRepository,
    approvalRepository: IDataImportApprovalRepository = inMemoryDataImportApprovalRepository,
    schemaRegistry: EntitySchemaRegistry = entitySchemaRegistry,
    auditServiceInstance: IAuditService = auditService,
    logger: StructuredLogger = new StructuredLogger('ApprovalService')
  ) {
    this.importRepository = importRepository;
    this.mappingRepository = mappingRepository;
    this.recordRepository = recordRepository;
    this.approvalRepository = approvalRepository;
    this.schemaRegistry = schemaRegistry;
    this.auditService = auditServiceInstance;
    this.logger = logger;
  }

  /**
   * Evaluates whether an import job requires explicit approval based on entity schema policies
   */
  public async evaluateApprovalPolicy(
    organizationId: string,
    importId: string
  ): Promise<{ requiresApproval: boolean; reasons: string[]; approverRoles: string[]; approverLabel: string }> {
    const importJob = await this.importRepository.findById(organizationId, importId);
    if (!importJob) {
      throw new NotFoundError(`Import job with ID '${importId}' not found`);
    }

    const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
    const policy = schema?.approvalPolicy;
    const moduleConfig = getModuleConfig(importJob.targetModule);
    const moduleApproverRoles = (moduleConfig?.allowedRoles || [])
      .filter(role => !['admin', 'org_admin'].includes(normalizeRoleCode(role)));
    const approverRoles = policy?.approverRoles?.length
      ? policy.approverRoles
      : moduleApproverRoles.length ? moduleApproverRoles : ['admin'];
    const reasons: string[] = [];

    if (policy?.requiresApproval) {
      reasons.push(`Entity '${importJob.targetEntity}' mandates approval by default policy`);
    }

    if (policy?.thresholdRowCount && importJob.totalRecords >= policy.thresholdRowCount) {
      reasons.push(
        `Import row count (${importJob.totalRecords}) exceeds approval threshold (${policy.thresholdRowCount})`
      );
    }

    if (
      policy?.requireForUpdateMode &&
      (importJob.importOptions.duplicateStrategy === 'UPDATE' ||
        (importJob as any).importMode === 'UPDATE_ONLY')
    ) {
      reasons.push('Update mode import requires approval under sensitive data policy');
    }

    const requiresApproval = reasons.length > 0 || importJob.requiresApproval;
    return {
      requiresApproval,
      reasons,
      approverRoles,
      approverLabel: policy?.approverLabel || approverRoles.map(role =>
        role.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
      ).join(' / ')
    };
  }

  /**
   * Submits a ready import to an alternate role configured by its entity policy.
   */
  public async submitForApproval(
    context: SecurityContext,
    importId: string
  ): Promise<DataImportApprovalEntity> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_CREATE)) {
      throw new ForbiddenError('Insufficient permissions to submit an import for approval');
    }

    const importJob = await this.importRepository.findById(context.organizationId, importId);
    if (!importJob) throw new NotFoundError(`Import job with ID '${importId}' not found`);

    const policy = await this.evaluateApprovalPolicy(context.organizationId, importId);
    if (!policy.requiresApproval) {
      throw new ValidationError('This import does not require approval under its configured policy');
    }
    if (importJob.status === ImportStatus.PENDING_APPROVAL) {
      const existing = await this.approvalRepository.findByImportId(context.organizationId, importId);
      if (existing?.isPending()) return existing;
    }
    if (importJob.status !== ImportStatus.VALIDATED) {
      throw new ValidationError(`Import must be ready for review before submission (current state: ${importJob.status})`);
    }
    if (!importJob.fileMetadata?.duplicateSummary) {
      throw new ValidationError('Complete the duplicate review before submitting this import for approval');
    }

    const staged = await this.recordRepository.findByImportId(context.organizationId, importId, { limit: 100000 });

    if (
      importJob.importOptions?.duplicateStrategy === DuplicateStrategy.UPDATE ||
      importJob.importOptions?.duplicateStrategy === DuplicateStrategy.SKIP
    ) {
      const unreviewedInFileDups = staged.data.filter(
        (r) => r.matchClassification === MatchClassification.DUPLICATE_IN_FILE && r.executionAction === ExecutionIntentAction.REVIEW
      );
      if (unreviewedInFileDups.length > 0) {
        for (const r of unreviewedInFileDups) {
          r.executionAction = ExecutionIntentAction.SKIP;
          r.status = RecordStatus.SKIPPED_DUPLICATE;
          r.isBlocked = false;
          r.blockedReason = null;
          r.executionReason = 'In-file duplicate automatically skipped by strategy';
          r.updatedAt = new Date();
        }
        await this.recordRepository.saveBatch(unreviewedInFileDups);
      }
    }

    const hasUnresolvedWork = staged.data.some(record =>
      record.executionAction === 'REVIEW' ||
      record.matchClassification === 'UNRESOLVED' ||
      (record.executionAction === 'BLOCKED' &&
        !(record.status === 'INVALID' && record.matchClassification === 'INVALID'))
    );
    if (hasUnresolvedWork) {
      throw new ValidationError('Resolve all matching issues before submitting this import for approval');
    }

    const requesterRoles = new Set((context.roles || []).map(normalizeRoleCode));
    const assignedApproverRole = policy.approverRoles
      .map(normalizeRoleCode)
      .find(role => !requesterRoles.has(role));
    if (!assignedApproverRole) {
      throw new ValidationError('The approval policy has no alternate approver role configured for this requester');
    }

    const snapshotHash = await this.computeSnapshotHash(context.organizationId, importId);
    const approval = new DataImportApprovalEntity({
      id: `appr_${randomUUID()}`,
      organizationId: context.organizationId,
      importId,
      decision: ApprovalStatus.PENDING,
      requestedBy: context.userId,
      requestedAt: new Date(),
      assignedApproverRole,
      snapshotHash
    });
    await this.approvalRepository.create(approval);

    ImportStateMachine.transition(importJob, ImportStatus.PENDING_APPROVAL);
    importJob.fileMetadata = {
      ...(importJob.fileMetadata || {}),
      approvalRouting: {
        assignedApproverRole,
        approverLabel: policy.approverLabel,
        submittedBy: context.userId,
        submittedAt: approval.requestedAt.toISOString()
      }
    };
    await this.importRepository.update(importJob);

    await this.auditService.recordEvent({
      organizationId: context.organizationId,
      importId,
      actorUserId: context.userId,
      action: 'IMPORT_SUBMITTED_FOR_APPROVAL',
      details: {
        approvalId: approval.id,
        assignedApproverRole,
        snapshotHash
      }
    });
    return approval;
  }

  private assertAssignedApprover(context: SecurityContext, approval: DataImportApprovalEntity): string {
    if (!approval.isPending()) {
      throw new ValidationError('This import does not have a pending approval request');
    }
    const assignedRole = approval.assignedApproverRole;
    const matchingRole = (context.roles || []).find(role =>
      normalizeRoleCode(role) === assignedRole
    );
    if (!assignedRole || !matchingRole) {
      throw new ForbiddenError(`This request is assigned to the ${assignedRole || 'configured'} approver role`);
    }
    return matchingRole;
  }

  /**
   * Computes a deterministic cryptographic SHA-256 snapshot hash representing current state
   */
  public async computeSnapshotHash(
    organizationId: string,
    importId: string
  ): Promise<string> {
    const importJob = await this.importRepository.findById(organizationId, importId);
    if (!importJob) {
      throw new NotFoundError(`Import job with ID '${importId}' not found`);
    }

    const mapping = await this.mappingRepository.findByImportId(organizationId, importId);
    const records = await this.recordRepository.findByImportId(organizationId, importId, {
      limit: 100000
    });

    const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
    const canonicalData = {
      importId,
      organizationId,
      entity: importJob.targetEntity,
      schemaVersion: schema?.version || 1,
      totalRecords: importJob.totalRecords,
      mapping: mapping?.columnMappings || {},
      stagedSignatures: records.data.map((r) => ({
        rowIndex: r.rowIndex,
        action: r.executionAction,
        targetId: r.targetRecordId,
        matchKeyHash: r.matchKeyHash
      }))
    };

    return createHash('sha256')
      .update(JSON.stringify(canonicalData), 'utf8')
      .digest('hex');
  }

  /**
   * Approves an import job for batch execution
   */
  public async approveImport(
    context: SecurityContext,
    importId: string,
    comment?: string
  ): Promise<DataImportApprovalEntity> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_APPROVE)) {
      throw new ForbiddenError('Insufficient permissions to approve import jobs (DATA_IMPORT_APPROVE required)');
    }

    const importJob = await this.importRepository.findById(context.organizationId, importId);
    if (!importJob) {
      throw new NotFoundError(`Import job with ID '${importId}' not found`);
    }
    const pendingApproval = await this.approvalRepository.findByImportId(context.organizationId, importId);
    if (!pendingApproval || importJob.status !== ImportStatus.PENDING_APPROVAL) {
      throw new ValidationError('Import must be submitted and pending approval before it can be approved');
    }
    const decidedByRole = this.assertAssignedApprover(context, pendingApproval);

    // Common RBAC Department Authorization Check
    const userRoles = context.roles || [];
    const isCrossDeptAdmin = userRoles.some((r) => {
      const norm = normalizeRoleCode(r);
      return ['admin', 'superadmin', 'org_admin'].includes(norm);
    });
    if (!isCrossDeptAdmin) {
      const targetConfig = getModuleConfig(importJob.targetModule);
      const targetModuleId = targetConfig ? targetConfig.id.toLowerCase() : (importJob.targetModule || '').toLowerCase();
      const allowedModules = userRoles.flatMap((role) => getModulesForRole(role)).map((m) => m.id.toLowerCase());
      if (
        targetModuleId &&
        !allowedModules.includes(targetModuleId) &&
        !allowedModules.includes((importJob.targetModule || '').toLowerCase())
      ) {
        throw new ForbiddenError(
          `Department authorization violation: Role(s) [${userRoles.join(', ')}] are not authorized to approve imports for department '${importJob.targetModule}'`
        );
      }
    }

    // Separation of Duties: Uploader cannot approve their own job
    if (pendingApproval.requestedBy === context.userId) {
      throw new ForbiddenError(
        'Separation of duties violation: You cannot approve an import job that you created or uploaded'
      );
    }

    if (
      importJob.status !== ImportStatus.PENDING_APPROVAL &&
      importJob.status !== ImportStatus.VALIDATED &&
      importJob.status !== ImportStatus.REQUIRES_APPROVAL
    ) {
      throw new ValidationError(
        `Import job in state '${importJob.status}' cannot be approved (Must be PENDING_APPROVAL or VALIDATED)`
      );
    }

    const currentHash = await this.computeSnapshotHash(context.organizationId, importId);

    // Persist Approval Entity
    const approval = new DataImportApprovalEntity({
      id: `appr_${randomUUID()}`,
      organizationId: context.organizationId,
      importId,
      decision: ApprovalStatus.APPROVED,
      requestedBy: pendingApproval.requestedBy,
      decidedBy: context.userId,
      decidedByRole,
      assignedApproverRole: pendingApproval.assignedApproverRole,
      decidedAt: new Date(),
      reason: comment || 'Import approved for production execution',
      snapshotHash: currentHash
    });

    await this.approvalRepository.create(approval);

    // Transition State Machine
    ImportStateMachine.transition(importJob, ImportStatus.APPROVED);
    importJob.fileMetadata = {
      ...(importJob.fileMetadata || {}),
      approvalRouting: {
        ...(importJob.fileMetadata?.approvalRouting || {}),
        decision: ApprovalStatus.APPROVED,
        decidedBy: context.userId,
        decidedByRole,
        decidedAt: approval.decidedAt?.toISOString() || null,
        reason: approval.reason
      }
    };
    await this.importRepository.update(importJob);

    // Audit Logging
    await this.auditService.recordEvent({
      organizationId: context.organizationId,
      importId,
      actorUserId: context.userId,
      action: 'IMPORT_APPROVED',
      details: {
        approvalId: approval.id,
        snapshotHash: currentHash,
        comment
      }
    });

    this.logger.info('Import approved successfully', {
      importId,
      approverId: context.userId,
      approvalId: approval.id
    });

    return approval;
  }

  /**
   * Rejects an import job
   */
  public async rejectImport(
    context: SecurityContext,
    importId: string,
    reason: string
  ): Promise<DataImportApprovalEntity> {
    if (!hasPermission(context, DataImportPermission.DATA_IMPORT_APPROVE)) {
      throw new ForbiddenError('Insufficient permissions to reject import jobs (DATA_IMPORT_APPROVE required)');
    }

    if (!reason || reason.trim() === '') {
      throw new ValidationError('A rejection reason must be provided');
    }

    const importJob = await this.importRepository.findById(context.organizationId, importId);
    if (!importJob) {
      throw new NotFoundError(`Import job with ID '${importId}' not found`);
    }
    const pendingApproval = await this.approvalRepository.findByImportId(context.organizationId, importId);
    if (!pendingApproval || importJob.status !== ImportStatus.PENDING_APPROVAL) {
      throw new ValidationError('Import must be submitted and pending approval before it can be rejected');
    }
    const decidedByRole = this.assertAssignedApprover(context, pendingApproval);

    // Common RBAC Department Authorization Check
    const userRoles = context.roles || [];
    const isCrossDeptAdmin = userRoles.some((r) => {
      const norm = normalizeRoleCode(r);
      return ['admin', 'superadmin', 'org_admin'].includes(norm);
    });
    if (!isCrossDeptAdmin) {
      const targetConfig = getModuleConfig(importJob.targetModule);
      const targetModuleId = targetConfig ? targetConfig.id.toLowerCase() : (importJob.targetModule || '').toLowerCase();
      const allowedModules = userRoles.flatMap((role) => getModulesForRole(role)).map((m) => m.id.toLowerCase());
      if (
        targetModuleId &&
        !allowedModules.includes(targetModuleId) &&
        !allowedModules.includes((importJob.targetModule || '').toLowerCase())
      ) {
        throw new ForbiddenError(
          `Department authorization violation: Role(s) [${userRoles.join(', ')}] are not authorized to reject imports for department '${importJob.targetModule}'`
        );
      }
    }

    // Separation of duties applies to both approval decisions: the creator
    // cannot reject/approve their own import when four-eyes governance is active.
    if (pendingApproval.requestedBy === context.userId) {
      throw new ForbiddenError(
        'Separation of duties violation: You cannot reject an import job that you created or uploaded'
      );
    }

    const currentHash = await this.computeSnapshotHash(context.organizationId, importId);

    const approval = new DataImportApprovalEntity({
      id: `appr_${randomUUID()}`,
      organizationId: context.organizationId,
      importId,
      decision: ApprovalStatus.REJECTED,
      requestedBy: pendingApproval.requestedBy,
      decidedBy: context.userId,
      decidedByRole,
      assignedApproverRole: pendingApproval.assignedApproverRole,
      decidedAt: new Date(),
      reason: reason.trim(),
      snapshotHash: currentHash
    });

    await this.approvalRepository.create(approval);

    ImportStateMachine.transition(importJob, ImportStatus.REJECTED);
    importJob.fileMetadata = {
      ...(importJob.fileMetadata || {}),
      approvalRouting: {
        ...(importJob.fileMetadata?.approvalRouting || {}),
        decision: ApprovalStatus.REJECTED,
        decidedBy: context.userId,
        decidedByRole,
        decidedAt: approval.decidedAt?.toISOString() || null,
        reason: approval.reason
      }
    };
    await this.importRepository.update(importJob);

    await this.auditService.recordEvent({
      organizationId: context.organizationId,
      importId,
      actorUserId: context.userId,
      action: 'IMPORT_REJECTED',
      details: {
        approvalId: approval.id,
        reason: reason.trim()
      }
    });

    this.logger.info('Import rejected', {
      importId,
      rejectedBy: context.userId,
      reason: reason.trim()
    });

    return approval;
  }

  /**
   * Invalidates approval upon material modification
   */
  public async invalidateApproval(
    organizationId: string,
    importId: string,
    invalidationReason: string
  ): Promise<void> {
    const existing = await this.approvalRepository.findByImportId(organizationId, importId);
    if (existing && (existing.isApproved() || existing.isPending())) {
      existing.decision = ApprovalStatus.INVALIDATED;
      existing.invalidationReason = invalidationReason;
      await this.approvalRepository.update(existing);

      this.logger.warn('Previous approval invalidated due to material changes', {
        importId,
        invalidationReason
      });
    }
  }

  public async getLatestApproval(
    organizationId: string,
    importId: string
  ): Promise<DataImportApprovalEntity | null> {
    return this.approvalRepository.findByImportId(organizationId, importId);
  }
}
