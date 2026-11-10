/**
 * API Request Validation Schemas using Zod
 */

import { z } from 'zod';
import {
  ImportStatus,
  ImportSourceType,
  DuplicateStrategy,
  ErrorStrategy,
  RecordStatus
} from '../../core/types/import.types.js';
import {
  MatchClassification,
  ExecutionIntentAction
} from '../../core/types/duplicate.types.js';

export const importOptionsSchema = z.object({
  batchSize: z.number().int().min(1).max(2000).optional(),
  skipHeaderRows: z.number().int().min(0).max(100).optional(),
  delimiter: z.string().max(5).optional(),
  encoding: z.string().max(20).optional(),
  timezone: z.string().max(50).optional(),
  dateFormat: z.string().max(50).optional(),
  duplicateStrategy: z.nativeEnum(DuplicateStrategy).default(DuplicateStrategy.SKIP),
  errorStrategy: z.nativeEnum(ErrorStrategy).default(ErrorStrategy.CONTINUE_ON_ERROR),
  notifyOnCompletion: z.boolean().optional(),
  notificationEmails: z.array(z.string().email()).optional(),
  customOptions: z.record(z.unknown()).optional()
});

export const createImportRequestSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  targetModule: z.string().trim().min(1).max(100).optional(),
  targetEntity: z.string().trim().min(1, 'Target entity is required').max(100),
  sourceType: z.nativeEnum(ImportSourceType).default(ImportSourceType.FILE_UPLOAD),
  sourceId: z.string().uuid().optional(),
  importOptions: importOptionsSchema.partial().optional()
});

export const updateImportRequestSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  targetModule: z.string().trim().min(1).max(100).optional(),
  targetEntity: z.string().trim().min(1).max(100).optional(),
  importOptions: importOptionsSchema.partial().optional()
});

export const listImportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(ImportStatus).optional(),
  targetModule: z.string().optional(),
  targetEntity: z.string().optional(),
  sourceType: z.nativeEnum(ImportSourceType).optional(),
  createdBy: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'status', 'totalRecords']).default('createdAt'),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC')
});


export const saveDraftRequestSchema = z.object({
  currentStep: z.number().int().min(1).max(10).optional()
});
export const cancelImportRequestSchema = z.object({
  reason: z.string().max(500).optional()
});

export const parseImportRequestSchema = z.object({
  delimiter: z.string().max(5).optional(),
  encoding: z.string().max(20).optional(),
  hasHeader: z.boolean().optional(),
  headerRow: z.number().int().min(0).max(100).optional(),
  sheet: z.string().max(100).optional(),
  previewLimit: z.number().int().min(1).max(500).optional(),
  jsonPath: z.string().optional(),
  xmlRecordPath: z.string().optional(),
  maxRows: z.number().int().min(1).max(500000).optional()
});

export const uploadFilePayloadSchema = z.object({
  filename: z.string().min(1).max(255),
  content: z.string().min(1), // Base64 or string content
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
  mimeType: z.string().optional()
});

export const columnMappingItemSchema = z.object({
  targetField: z.string().min(1, 'Target field is required'),
  mappingMethod: z.enum(['AUTOMATIC', 'MANUAL', 'TEMPLATE']).default('MANUAL'),
  defaultValue: z.unknown().optional(),
  enabled: z.boolean().default(true),
  transformations: z.array(
    z.union([
      z.string().min(1),
      z.object({ type: z.string().min(1), options: z.record(z.string(), z.unknown()).optional() })
    ])
  ).optional()
});

export const saveMappingRequestSchema = z.object({
  columnMappings: z.record(z.string(), columnMappingItemSchema),
  unmappedBehavior: z.enum(['IGNORE', 'SET_NULL']).default('IGNORE'),
  defaultValues: z.record(z.string(), z.unknown()).optional()
});

export const validateMappingRequestSchema = z.object({
  columnMappings: z.record(z.string(), columnMappingItemSchema).optional(),
  unmappedBehavior: z.enum(['IGNORE', 'SET_NULL']).default('IGNORE'),
  defaultValues: z.record(z.string(), z.unknown()).optional()
});

export const validateImportRequestSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  maxErrors: z.number().int().min(1).max(10000).optional().default(1000)
});

export const validationPreviewQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  errorCode: z.string().optional(),
  column: z.string().optional(),
  search: z.string().optional(),
  requiresAction: z.coerce.boolean().optional()
});

export const bulkCorrectRequestSchema = z.object({
  field: z.string().trim().min(1, 'Target field is required'),
  oldValue: z.unknown().optional(),
  newValue: z.unknown(),
  errorCode: z.string().optional()
});

export const detectDuplicatesRequestSchema = z.object({
  overrideStrategy: z.nativeEnum(DuplicateStrategy).optional()
});

export const approveImportRequestSchema = z.object({
  comment: z.string().max(500).optional(),
  reason: z.string().max(500).optional(),
  decision: z.string().optional()
});

export const rejectImportRequestSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(500)
});

export const matchPreviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  classification: z.nativeEnum(MatchClassification).optional(),
  action: z.nativeEnum(ExecutionIntentAction).optional(),
  isDuplicate: z.coerce.boolean().optional(),
  isBlocked: z.coerce.boolean().optional()
});

export const reviewRecordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  status: z.nativeEnum(RecordStatus).optional(),
  classification: z.nativeEnum(MatchClassification).optional(),
  action: z.nativeEnum(ExecutionIntentAction).optional(),
  isBlocked: z.coerce.boolean().optional()
});

export const executeImportRequestSchema = z.object({
  batchSize: z.number().int().min(1).max(2000).optional()
});

export const failedRecordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  category: z.enum([
    'VALIDATION_ERROR',
    'MAPPING_ERROR',
    'MATCH_ERROR',
    'AUTHORIZATION_ERROR',
    'TARGET_NOT_FOUND',
    'CONSTRAINT_ERROR',
    'CONFLICT_ERROR',
    'TRANSIENT_ERROR',
    'SYSTEM_ERROR',
    'UNKNOWN_ERROR'
  ]).optional(),
  retryability: z.enum(['RETRYABLE', 'NON_RETRYABLE', 'UNKNOWN']).optional(),
  errorCode: z.string().optional()
});

export const exportReportQuerySchema = z.object({
  format: z.enum(['json', 'csv', 'pdf', 'docx']).default('csv')
});

export const retryImportRequestSchema = z.object({
  maxRetries: z.number().int().min(1).max(10).default(3),
  recordIds: z.array(z.string()).optional(),
  forceRetryAll: z.boolean().default(false)
});



