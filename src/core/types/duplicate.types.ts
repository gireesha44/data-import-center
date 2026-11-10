/**
 * Duplicate Detection and Record Matching Domain Types
 */

import { DuplicateStrategy, ImportMode } from './import.types.js';

export enum MatchClassification {
  NEW = 'NEW',
  EXISTING = 'EXISTING',
  DUPLICATE_IN_FILE = 'DUPLICATE_IN_FILE',
  DUPLICATE_IN_TARGET = 'DUPLICATE_IN_TARGET',
  MULTIPLE_MATCH = 'MULTIPLE_MATCH',
  CONFLICT = 'CONFLICT',
  UNRESOLVED = 'UNRESOLVED',
  INVALID = 'INVALID'
}

export enum MatchConfidence {
  EXACT = 'EXACT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  NONE = 'NONE'
}

export enum ExecutionIntentAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  SKIP = 'SKIP',
  REJECT = 'REJECT',
  REVIEW = 'REVIEW',
  BLOCKED = 'BLOCKED'
}

export interface MatchIssue {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFORMATION';
  field?: string;
}

export interface RecordMatchResult {
  recordId: string;
  sourceRowNumber: number;
  classification: MatchClassification;
  matchStrategy: string;
  matchKey: string | null;
  matchKeyHash: string | null;
  matchedTargetId?: string | null;
  candidateTargetIds?: string[];
  confidence: MatchConfidence;
  reasons: string[];
  issues: MatchIssue[];
}

export interface ExecutionIntent {
  recordId: string;
  action: ExecutionIntentAction;
  targetId?: string | null;
  reason: string;
  matchResult: RecordMatchResult;
  blocked: boolean;
  blockedReason?: string | null;
}

export interface DuplicateGroupRecord {
  recordId: string;
  sourceRowNumber: number;
  role: 'PRIMARY' | 'DUPLICATE';
  isPrimary: boolean;
  data: Record<string, unknown>;
  matchKey: string;
  matchedTargetId?: string | null;
  targetRecordData?: Record<string, unknown> | null;
  resolutionAction: ExecutionIntentAction;
  resolutionReason: string;
  availableActions: ('PROTECTED' | 'SKIP' | 'REJECT' | 'EDIT')[];
}

export interface DuplicateGroup {
  id: string;
  groupIndex: number;
  groupKey?: string;
  matchKey: string;
  matchKeyHash: string;
  type: 'IN_FILE_DUPLICATE' | 'DATABASE_MATCH' | 'HYBRID_MATCH';
  classification: MatchClassification;
  count: number;
  recordsCount: number;
  sourceRowNumbers: number[];
  recordIds: string[];
  primaryRecordId?: string | null;
  primaryRowNumber?: number | null;
  matchedTargetId?: string | null;
  targetRecordData?: Record<string, unknown> | null;
  sampleRecordData?: Record<string, unknown> | null;
  status: 'REQUIRES_RESOLUTION' | 'RESOLVED';
  isResolved?: boolean;
  resolutionAction?: ExecutionIntentAction;
  resolutionReason?: string;
  records: DuplicateGroupRecord[];
}

export interface DuplicateSummary {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  newRecords: number;
  existingRecords: number;
  duplicateInFile: number;
  duplicateInTarget: number;
  duplicateRecords?: number;
  multipleMatches: number;
  conflicts: number;
  unresolved: number;
  creates: number;
  updates: number;
  resolvedUpdates?: number;
  skips: number;
  rejected?: number;
  reviews: number;
  blocked: number;
  duplicateGroups: DuplicateGroup[];
  resolvedDuplicateGroups?: DuplicateGroup[];
  recordResolution?: {
    recordId: string;
    resolved: boolean;
    action: ExecutionIntentAction;
    reason: string | null;
  };
}

export interface DuplicatePreviewItem {
  id: string;
  rowIndex: number;
  status: string;
  classification: MatchClassification;
  matchKey: string | null;
  matchKeyHash: string | null;
  matchedTargetId: string | null;
  candidateTargetIds: string[];
  executionAction: ExecutionIntentAction;
  executionReason: string;
  isBlocked: boolean;
  blockedReason: string | null;
  isDuplicate?: boolean;
  rawData: Record<string, unknown>;
  transformedData: Record<string, unknown> | null;
  issues: MatchIssue[];
}

export interface MatchPreviewQuery {
  page?: number;
  limit?: number;
  classification?: MatchClassification;
  action?: ExecutionIntentAction;
  isDuplicate?: boolean;
  isBlocked?: boolean;
}

export interface TargetRecordMatch {
  id: string;
  matchKey: string;
  matchKeyHash: string;
  data: Record<string, unknown>;
}

export interface ITargetMatchProvider {
  readonly entity: string;
  findByMatchKeys(
    organizationId: string,
    matchKeyHashes: string[],
    matchKeys: string[]
  ): Promise<Map<string, TargetRecordMatch[]>>;
  getRecord(organizationId: string, recordId: string): Promise<Record<string, unknown> | null>;
  createRecord(
    organizationId: string,
    data: Record<string, unknown>
  ): Promise<{ id: string; record: Record<string, unknown> }>;
  updateRecord(
    organizationId: string,
    recordId: string,
    data: Record<string, unknown>
  ): Promise<{ id: string; record: Record<string, unknown> }>;
  deleteRecord(organizationId: string, recordId: string): Promise<boolean>;
}
