/**
 * Review, Approval and Batch Execution Domain Types
 */

import { RecordStatus, ExecutionStatus, ApprovalStatus } from './import.types.js';
import { MatchClassification, ExecutionIntentAction } from './duplicate.types.js';

export enum ReviewReadiness {
  READY = 'READY',
  NOT_READY = 'NOT_READY',
  BLOCKED = 'BLOCKED'
}

export interface ReviewChecklistItem {
  code: string;
  title: string;
  passed: boolean;
  blocking: boolean;
  message: string;
}

export interface ReviewSummary {
  importId: string;
  importName: string;
  department: string;
  fileName: string | null;
  targetEntity: string;
  readiness: ReviewReadiness;
  readinessLabel: 'READY FOR IMPORT' | 'READY FOR APPROVAL' | 'ACTION REQUIRED';
  status: string;
  totalRecords: number;
  validRecords: number;
  warningRecords: number;
  invalidRecords: number;
  newRecords: number;
  existingRecords: number;
  duplicateRecords: number;
  conflictRecords: number;
  unresolvedRecords: number;
  plannedCreates: number;
  plannedUpdates: number;
  plannedSkips: number;
  plannedBlocked: number;
  plannedRejected: number;
  plannedFailed: number;
  unresolvedValidationErrors: number;
  unresolvedDuplicates: number;
  unresolvedBlockingIssues: number;
  itemsNeedingReview: number;
  requiresApproval: boolean;
  approvalStatus: ApprovalStatus;
  approverLabel?: string;
  assignedApproverRole?: string | null;
  submittedBy?: string | null;
  rejectionReason?: string | null;
  approvalDetails?: {
    approvedBy?: string | null;
    approvedByRole?: string | null;
    approvedAt?: string | null;
    requestedBy?: string | null;
    requestedAt?: string | null;
    assignedApproverRole?: string | null;
    decidedByRole?: string | null;
    reason?: string | null;
    snapshotHash?: string;
  };
  checklist: ReviewChecklistItem[];
  blockingIssues: string[];
}

export interface ReviewFieldComparison {
  field: string;
  label: string;
  sourceHeader?: string;
  rawValue: unknown;
  transformedValue: unknown;
  hasChanged: boolean;
}

export interface ReviewRecordItem {
  id: string;
  rowIndex: number;
  status: RecordStatus;
  classification: MatchClassification;
  targetRecordId: string | null;
  executionAction: ExecutionIntentAction;
  executionReason: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  hasErrors: boolean;
  hasWarnings: boolean;
  validationErrorsCount: number;
  rawData: Record<string, unknown>;
  transformedData: Record<string, unknown> | null;
}

export interface ReviewRecordDetail extends ReviewRecordItem {
  fieldComparisons: ReviewFieldComparison[];
  issues: Array<{
    field: string;
    code: string;
    message: string;
    severity: 'ERROR' | 'WARNING' | 'INFORMATION';
  }>;
}

export interface ReviewFilterQuery {
  page?: number;
  limit?: number;
  status?: RecordStatus;
  classification?: MatchClassification;
  action?: ExecutionIntentAction;
  isBlocked?: boolean;
}

export interface ApprovalDecisionInput {
  decision: 'APPROVE' | 'REJECT';
  reason?: string;
  comment?: string;
}

export interface ExecutionPlanItem {
  recordId: string;
  rowIndex: number;
  action: ExecutionIntentAction;
  targetId?: string | null;
  payload: Record<string, unknown>;
  isBlocked: boolean;
  blockedReason?: string | null;
}

export interface ExecutionPlan {
  importId: string;
  organizationId: string;
  targetEntity: string;
  version: number;
  snapshotHash: string;
  createdAt: Date;
  items: ExecutionPlanItem[];
}

export interface ExecutionRecordResult {
  recordId: string;
  rowIndex: number;
  action: ExecutionIntentAction;
  status: RecordStatus;
  targetRecordId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt: Date;
  completedAt: Date;
}

export interface ExecutionSummaryDto {
  executionId: string;
  importId: string;
  status: ExecutionStatus;
  totalRecords: number;
  successfulCreates: number;
  successfulUpdates: number;
  skippedRecords: number;
  rejectedRecords: number;
  blockedRecords: number;
  failedRecords: number;
  completedBatches: number;
  totalBatches: number;
  durationMs: number;
  startedAt: string | null;
  finishedAt: string | null;
  errorSummary: Record<string, unknown>;
}
