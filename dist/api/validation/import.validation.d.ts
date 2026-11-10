/**
 * API Request Validation Schemas using Zod
 */
import { z } from 'zod';
import { ImportStatus, ImportSourceType, DuplicateStrategy, ErrorStrategy, RecordStatus } from '../../core/types/import.types.js';
import { MatchClassification, ExecutionIntentAction } from '../../core/types/duplicate.types.js';
export declare const importOptionsSchema: z.ZodObject<{
    batchSize: z.ZodOptional<z.ZodNumber>;
    skipHeaderRows: z.ZodOptional<z.ZodNumber>;
    delimiter: z.ZodOptional<z.ZodString>;
    encoding: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
    dateFormat: z.ZodOptional<z.ZodString>;
    duplicateStrategy: z.ZodDefault<z.ZodNativeEnum<typeof DuplicateStrategy>>;
    errorStrategy: z.ZodDefault<z.ZodNativeEnum<typeof ErrorStrategy>>;
    notifyOnCompletion: z.ZodOptional<z.ZodBoolean>;
    notificationEmails: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    customOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    duplicateStrategy: DuplicateStrategy;
    errorStrategy: ErrorStrategy;
    batchSize?: number | undefined;
    skipHeaderRows?: number | undefined;
    delimiter?: string | undefined;
    encoding?: string | undefined;
    timezone?: string | undefined;
    dateFormat?: string | undefined;
    notifyOnCompletion?: boolean | undefined;
    notificationEmails?: string[] | undefined;
    customOptions?: Record<string, unknown> | undefined;
}, {
    batchSize?: number | undefined;
    skipHeaderRows?: number | undefined;
    delimiter?: string | undefined;
    encoding?: string | undefined;
    timezone?: string | undefined;
    dateFormat?: string | undefined;
    duplicateStrategy?: DuplicateStrategy | undefined;
    errorStrategy?: ErrorStrategy | undefined;
    notifyOnCompletion?: boolean | undefined;
    notificationEmails?: string[] | undefined;
    customOptions?: Record<string, unknown> | undefined;
}>;
export declare const createImportRequestSchema: z.ZodObject<{
    name: z.ZodString;
    targetModule: z.ZodOptional<z.ZodString>;
    targetEntity: z.ZodString;
    sourceType: z.ZodDefault<z.ZodNativeEnum<typeof ImportSourceType>>;
    sourceId: z.ZodOptional<z.ZodString>;
    importOptions: z.ZodOptional<z.ZodObject<{
        batchSize: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        skipHeaderRows: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        delimiter: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        encoding: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        timezone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        dateFormat: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        duplicateStrategy: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof DuplicateStrategy>>>;
        errorStrategy: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof ErrorStrategy>>>;
        notifyOnCompletion: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        notificationEmails: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        customOptions: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, "strip", z.ZodTypeAny, {
        batchSize?: number | undefined;
        skipHeaderRows?: number | undefined;
        delimiter?: string | undefined;
        encoding?: string | undefined;
        timezone?: string | undefined;
        dateFormat?: string | undefined;
        duplicateStrategy?: DuplicateStrategy | undefined;
        errorStrategy?: ErrorStrategy | undefined;
        notifyOnCompletion?: boolean | undefined;
        notificationEmails?: string[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    }, {
        batchSize?: number | undefined;
        skipHeaderRows?: number | undefined;
        delimiter?: string | undefined;
        encoding?: string | undefined;
        timezone?: string | undefined;
        dateFormat?: string | undefined;
        duplicateStrategy?: DuplicateStrategy | undefined;
        errorStrategy?: ErrorStrategy | undefined;
        notifyOnCompletion?: boolean | undefined;
        notificationEmails?: string[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    targetEntity: string;
    sourceType: ImportSourceType;
    targetModule?: string | undefined;
    importOptions?: {
        batchSize?: number | undefined;
        skipHeaderRows?: number | undefined;
        delimiter?: string | undefined;
        encoding?: string | undefined;
        timezone?: string | undefined;
        dateFormat?: string | undefined;
        duplicateStrategy?: DuplicateStrategy | undefined;
        errorStrategy?: ErrorStrategy | undefined;
        notifyOnCompletion?: boolean | undefined;
        notificationEmails?: string[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    } | undefined;
    sourceId?: string | undefined;
}, {
    name: string;
    targetEntity: string;
    targetModule?: string | undefined;
    sourceType?: ImportSourceType | undefined;
    importOptions?: {
        batchSize?: number | undefined;
        skipHeaderRows?: number | undefined;
        delimiter?: string | undefined;
        encoding?: string | undefined;
        timezone?: string | undefined;
        dateFormat?: string | undefined;
        duplicateStrategy?: DuplicateStrategy | undefined;
        errorStrategy?: ErrorStrategy | undefined;
        notifyOnCompletion?: boolean | undefined;
        notificationEmails?: string[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    } | undefined;
    sourceId?: string | undefined;
}>;
export declare const updateImportRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    targetModule: z.ZodOptional<z.ZodString>;
    targetEntity: z.ZodOptional<z.ZodString>;
    importOptions: z.ZodOptional<z.ZodObject<{
        batchSize: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        skipHeaderRows: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        delimiter: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        encoding: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        timezone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        dateFormat: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        duplicateStrategy: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof DuplicateStrategy>>>;
        errorStrategy: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof ErrorStrategy>>>;
        notifyOnCompletion: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        notificationEmails: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        customOptions: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, "strip", z.ZodTypeAny, {
        batchSize?: number | undefined;
        skipHeaderRows?: number | undefined;
        delimiter?: string | undefined;
        encoding?: string | undefined;
        timezone?: string | undefined;
        dateFormat?: string | undefined;
        duplicateStrategy?: DuplicateStrategy | undefined;
        errorStrategy?: ErrorStrategy | undefined;
        notifyOnCompletion?: boolean | undefined;
        notificationEmails?: string[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    }, {
        batchSize?: number | undefined;
        skipHeaderRows?: number | undefined;
        delimiter?: string | undefined;
        encoding?: string | undefined;
        timezone?: string | undefined;
        dateFormat?: string | undefined;
        duplicateStrategy?: DuplicateStrategy | undefined;
        errorStrategy?: ErrorStrategy | undefined;
        notifyOnCompletion?: boolean | undefined;
        notificationEmails?: string[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    targetModule?: string | undefined;
    targetEntity?: string | undefined;
    importOptions?: {
        batchSize?: number | undefined;
        skipHeaderRows?: number | undefined;
        delimiter?: string | undefined;
        encoding?: string | undefined;
        timezone?: string | undefined;
        dateFormat?: string | undefined;
        duplicateStrategy?: DuplicateStrategy | undefined;
        errorStrategy?: ErrorStrategy | undefined;
        notifyOnCompletion?: boolean | undefined;
        notificationEmails?: string[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    } | undefined;
}, {
    name?: string | undefined;
    targetModule?: string | undefined;
    targetEntity?: string | undefined;
    importOptions?: {
        batchSize?: number | undefined;
        skipHeaderRows?: number | undefined;
        delimiter?: string | undefined;
        encoding?: string | undefined;
        timezone?: string | undefined;
        dateFormat?: string | undefined;
        duplicateStrategy?: DuplicateStrategy | undefined;
        errorStrategy?: ErrorStrategy | undefined;
        notifyOnCompletion?: boolean | undefined;
        notificationEmails?: string[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    } | undefined;
}>;
export declare const listImportsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof ImportStatus>>;
    targetModule: z.ZodOptional<z.ZodString>;
    targetEntity: z.ZodOptional<z.ZodString>;
    sourceType: z.ZodOptional<z.ZodNativeEnum<typeof ImportSourceType>>;
    createdBy: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["createdAt", "updatedAt", "name", "status", "totalRecords"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["ASC", "DESC"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    sortBy: "status" | "name" | "totalRecords" | "createdAt" | "updatedAt";
    sortOrder: "ASC" | "DESC";
    status?: ImportStatus | undefined;
    targetModule?: string | undefined;
    targetEntity?: string | undefined;
    sourceType?: ImportSourceType | undefined;
    createdBy?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}, {
    status?: ImportStatus | undefined;
    targetModule?: string | undefined;
    targetEntity?: string | undefined;
    sourceType?: ImportSourceType | undefined;
    limit?: number | undefined;
    page?: number | undefined;
    createdBy?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    sortBy?: "status" | "name" | "totalRecords" | "createdAt" | "updatedAt" | undefined;
    sortOrder?: "ASC" | "DESC" | undefined;
}>;
export declare const saveDraftRequestSchema: z.ZodObject<{
    currentStep: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    currentStep?: number | undefined;
}, {
    currentStep?: number | undefined;
}>;
export declare const cancelImportRequestSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export declare const parseImportRequestSchema: z.ZodObject<{
    delimiter: z.ZodOptional<z.ZodString>;
    encoding: z.ZodOptional<z.ZodString>;
    hasHeader: z.ZodOptional<z.ZodBoolean>;
    headerRow: z.ZodOptional<z.ZodNumber>;
    sheet: z.ZodOptional<z.ZodString>;
    previewLimit: z.ZodOptional<z.ZodNumber>;
    jsonPath: z.ZodOptional<z.ZodString>;
    xmlRecordPath: z.ZodOptional<z.ZodString>;
    maxRows: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    delimiter?: string | undefined;
    encoding?: string | undefined;
    hasHeader?: boolean | undefined;
    sheet?: string | undefined;
    headerRow?: number | undefined;
    previewLimit?: number | undefined;
    jsonPath?: string | undefined;
    xmlRecordPath?: string | undefined;
    maxRows?: number | undefined;
}, {
    delimiter?: string | undefined;
    encoding?: string | undefined;
    hasHeader?: boolean | undefined;
    sheet?: string | undefined;
    headerRow?: number | undefined;
    previewLimit?: number | undefined;
    jsonPath?: string | undefined;
    xmlRecordPath?: string | undefined;
    maxRows?: number | undefined;
}>;
export declare const uploadFilePayloadSchema: z.ZodObject<{
    filename: z.ZodString;
    content: z.ZodString;
    encoding: z.ZodDefault<z.ZodEnum<["utf-8", "base64"]>>;
    mimeType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    encoding: "utf-8" | "base64";
    filename: string;
    content: string;
    mimeType?: string | undefined;
}, {
    filename: string;
    content: string;
    encoding?: "utf-8" | "base64" | undefined;
    mimeType?: string | undefined;
}>;
export declare const columnMappingItemSchema: z.ZodObject<{
    targetField: z.ZodString;
    mappingMethod: z.ZodDefault<z.ZodEnum<["AUTOMATIC", "MANUAL", "TEMPLATE"]>>;
    defaultValue: z.ZodOptional<z.ZodUnknown>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    transformations: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
        type: z.ZodString;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        options?: Record<string, unknown> | undefined;
    }, {
        type: string;
        options?: Record<string, unknown> | undefined;
    }>]>, "many">>;
}, "strip", z.ZodTypeAny, {
    targetField: string;
    mappingMethod: "AUTOMATIC" | "MANUAL" | "TEMPLATE";
    enabled: boolean;
    transformations?: (string | {
        type: string;
        options?: Record<string, unknown> | undefined;
    })[] | undefined;
    defaultValue?: unknown;
}, {
    targetField: string;
    transformations?: (string | {
        type: string;
        options?: Record<string, unknown> | undefined;
    })[] | undefined;
    defaultValue?: unknown;
    mappingMethod?: "AUTOMATIC" | "MANUAL" | "TEMPLATE" | undefined;
    enabled?: boolean | undefined;
}>;
export declare const saveMappingRequestSchema: z.ZodObject<{
    columnMappings: z.ZodRecord<z.ZodString, z.ZodObject<{
        targetField: z.ZodString;
        mappingMethod: z.ZodDefault<z.ZodEnum<["AUTOMATIC", "MANUAL", "TEMPLATE"]>>;
        defaultValue: z.ZodOptional<z.ZodUnknown>;
        enabled: z.ZodDefault<z.ZodBoolean>;
        transformations: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            type: z.ZodString;
            options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            options?: Record<string, unknown> | undefined;
        }, {
            type: string;
            options?: Record<string, unknown> | undefined;
        }>]>, "many">>;
    }, "strip", z.ZodTypeAny, {
        targetField: string;
        mappingMethod: "AUTOMATIC" | "MANUAL" | "TEMPLATE";
        enabled: boolean;
        transformations?: (string | {
            type: string;
            options?: Record<string, unknown> | undefined;
        })[] | undefined;
        defaultValue?: unknown;
    }, {
        targetField: string;
        transformations?: (string | {
            type: string;
            options?: Record<string, unknown> | undefined;
        })[] | undefined;
        defaultValue?: unknown;
        mappingMethod?: "AUTOMATIC" | "MANUAL" | "TEMPLATE" | undefined;
        enabled?: boolean | undefined;
    }>>;
    unmappedBehavior: z.ZodDefault<z.ZodEnum<["IGNORE", "SET_NULL"]>>;
    defaultValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    columnMappings: Record<string, {
        targetField: string;
        mappingMethod: "AUTOMATIC" | "MANUAL" | "TEMPLATE";
        enabled: boolean;
        transformations?: (string | {
            type: string;
            options?: Record<string, unknown> | undefined;
        })[] | undefined;
        defaultValue?: unknown;
    }>;
    unmappedBehavior: "IGNORE" | "SET_NULL";
    defaultValues?: Record<string, unknown> | undefined;
}, {
    columnMappings: Record<string, {
        targetField: string;
        transformations?: (string | {
            type: string;
            options?: Record<string, unknown> | undefined;
        })[] | undefined;
        defaultValue?: unknown;
        mappingMethod?: "AUTOMATIC" | "MANUAL" | "TEMPLATE" | undefined;
        enabled?: boolean | undefined;
    }>;
    unmappedBehavior?: "IGNORE" | "SET_NULL" | undefined;
    defaultValues?: Record<string, unknown> | undefined;
}>;
export declare const validateMappingRequestSchema: z.ZodObject<{
    columnMappings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        targetField: z.ZodString;
        mappingMethod: z.ZodDefault<z.ZodEnum<["AUTOMATIC", "MANUAL", "TEMPLATE"]>>;
        defaultValue: z.ZodOptional<z.ZodUnknown>;
        enabled: z.ZodDefault<z.ZodBoolean>;
        transformations: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            type: z.ZodString;
            options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            options?: Record<string, unknown> | undefined;
        }, {
            type: string;
            options?: Record<string, unknown> | undefined;
        }>]>, "many">>;
    }, "strip", z.ZodTypeAny, {
        targetField: string;
        mappingMethod: "AUTOMATIC" | "MANUAL" | "TEMPLATE";
        enabled: boolean;
        transformations?: (string | {
            type: string;
            options?: Record<string, unknown> | undefined;
        })[] | undefined;
        defaultValue?: unknown;
    }, {
        targetField: string;
        transformations?: (string | {
            type: string;
            options?: Record<string, unknown> | undefined;
        })[] | undefined;
        defaultValue?: unknown;
        mappingMethod?: "AUTOMATIC" | "MANUAL" | "TEMPLATE" | undefined;
        enabled?: boolean | undefined;
    }>>>;
    unmappedBehavior: z.ZodDefault<z.ZodEnum<["IGNORE", "SET_NULL"]>>;
    defaultValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    unmappedBehavior: "IGNORE" | "SET_NULL";
    columnMappings?: Record<string, {
        targetField: string;
        mappingMethod: "AUTOMATIC" | "MANUAL" | "TEMPLATE";
        enabled: boolean;
        transformations?: (string | {
            type: string;
            options?: Record<string, unknown> | undefined;
        })[] | undefined;
        defaultValue?: unknown;
    }> | undefined;
    defaultValues?: Record<string, unknown> | undefined;
}, {
    columnMappings?: Record<string, {
        targetField: string;
        transformations?: (string | {
            type: string;
            options?: Record<string, unknown> | undefined;
        })[] | undefined;
        defaultValue?: unknown;
        mappingMethod?: "AUTOMATIC" | "MANUAL" | "TEMPLATE" | undefined;
        enabled?: boolean | undefined;
    }> | undefined;
    unmappedBehavior?: "IGNORE" | "SET_NULL" | undefined;
    defaultValues?: Record<string, unknown> | undefined;
}>;
export declare const validateImportRequestSchema: z.ZodObject<{
    dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    maxErrors: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    dryRun: boolean;
    maxErrors: number;
}, {
    dryRun?: boolean | undefined;
    maxErrors?: number | undefined;
}>;
export declare const validationPreviewQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    errorCode: z.ZodOptional<z.ZodString>;
    column: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    requiresAction: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    status?: string | undefined;
    errorCode?: string | undefined;
    column?: string | undefined;
    search?: string | undefined;
    requiresAction?: boolean | undefined;
}, {
    status?: string | undefined;
    limit?: number | undefined;
    errorCode?: string | undefined;
    page?: number | undefined;
    column?: string | undefined;
    search?: string | undefined;
    requiresAction?: boolean | undefined;
}>;
export declare const bulkCorrectRequestSchema: z.ZodObject<{
    field: z.ZodString;
    oldValue: z.ZodOptional<z.ZodUnknown>;
    newValue: z.ZodUnknown;
    errorCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    field: string;
    newValue?: unknown;
    oldValue?: unknown;
    errorCode?: string | undefined;
}, {
    field: string;
    newValue?: unknown;
    oldValue?: unknown;
    errorCode?: string | undefined;
}>;
export declare const detectDuplicatesRequestSchema: z.ZodObject<{
    overrideStrategy: z.ZodOptional<z.ZodNativeEnum<typeof DuplicateStrategy>>;
}, "strip", z.ZodTypeAny, {
    overrideStrategy?: DuplicateStrategy | undefined;
}, {
    overrideStrategy?: DuplicateStrategy | undefined;
}>;
export declare const approveImportRequestSchema: z.ZodObject<{
    comment: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    decision: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
    comment?: string | undefined;
    decision?: string | undefined;
}, {
    reason?: string | undefined;
    comment?: string | undefined;
    decision?: string | undefined;
}>;
export declare const rejectImportRequestSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const matchPreviewQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    classification: z.ZodOptional<z.ZodNativeEnum<typeof MatchClassification>>;
    action: z.ZodOptional<z.ZodNativeEnum<typeof ExecutionIntentAction>>;
    isDuplicate: z.ZodOptional<z.ZodBoolean>;
    isBlocked: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    classification?: MatchClassification | undefined;
    action?: ExecutionIntentAction | undefined;
    isDuplicate?: boolean | undefined;
    isBlocked?: boolean | undefined;
}, {
    classification?: MatchClassification | undefined;
    action?: ExecutionIntentAction | undefined;
    limit?: number | undefined;
    page?: number | undefined;
    isDuplicate?: boolean | undefined;
    isBlocked?: boolean | undefined;
}>;
export declare const reviewRecordsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof RecordStatus>>;
    classification: z.ZodOptional<z.ZodNativeEnum<typeof MatchClassification>>;
    action: z.ZodOptional<z.ZodNativeEnum<typeof ExecutionIntentAction>>;
    isBlocked: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    status?: RecordStatus | undefined;
    classification?: MatchClassification | undefined;
    action?: ExecutionIntentAction | undefined;
    isBlocked?: boolean | undefined;
}, {
    status?: RecordStatus | undefined;
    classification?: MatchClassification | undefined;
    action?: ExecutionIntentAction | undefined;
    limit?: number | undefined;
    page?: number | undefined;
    isBlocked?: boolean | undefined;
}>;
export declare const executeImportRequestSchema: z.ZodObject<{
    batchSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    batchSize?: number | undefined;
}, {
    batchSize?: number | undefined;
}>;
export declare const failedRecordsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    category: z.ZodOptional<z.ZodEnum<["VALIDATION_ERROR", "MAPPING_ERROR", "MATCH_ERROR", "AUTHORIZATION_ERROR", "TARGET_NOT_FOUND", "CONSTRAINT_ERROR", "CONFLICT_ERROR", "TRANSIENT_ERROR", "SYSTEM_ERROR", "UNKNOWN_ERROR"]>>;
    retryability: z.ZodOptional<z.ZodEnum<["RETRYABLE", "NON_RETRYABLE", "UNKNOWN"]>>;
    errorCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    category?: "VALIDATION_ERROR" | "MAPPING_ERROR" | "MATCH_ERROR" | "AUTHORIZATION_ERROR" | "TARGET_NOT_FOUND" | "CONSTRAINT_ERROR" | "CONFLICT_ERROR" | "TRANSIENT_ERROR" | "SYSTEM_ERROR" | "UNKNOWN_ERROR" | undefined;
    errorCode?: string | undefined;
    retryability?: "UNKNOWN" | "RETRYABLE" | "NON_RETRYABLE" | undefined;
}, {
    category?: "VALIDATION_ERROR" | "MAPPING_ERROR" | "MATCH_ERROR" | "AUTHORIZATION_ERROR" | "TARGET_NOT_FOUND" | "CONSTRAINT_ERROR" | "CONFLICT_ERROR" | "TRANSIENT_ERROR" | "SYSTEM_ERROR" | "UNKNOWN_ERROR" | undefined;
    limit?: number | undefined;
    errorCode?: string | undefined;
    page?: number | undefined;
    retryability?: "UNKNOWN" | "RETRYABLE" | "NON_RETRYABLE" | undefined;
}>;
export declare const exportReportQuerySchema: z.ZodObject<{
    format: z.ZodDefault<z.ZodEnum<["json", "csv", "pdf", "docx"]>>;
}, "strip", z.ZodTypeAny, {
    format: "json" | "csv" | "pdf" | "docx";
}, {
    format?: "json" | "csv" | "pdf" | "docx" | undefined;
}>;
export declare const retryImportRequestSchema: z.ZodObject<{
    maxRetries: z.ZodDefault<z.ZodNumber>;
    recordIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    forceRetryAll: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    maxRetries: number;
    forceRetryAll: boolean;
    recordIds?: string[] | undefined;
}, {
    maxRetries?: number | undefined;
    recordIds?: string[] | undefined;
    forceRetryAll?: boolean | undefined;
}>;
//# sourceMappingURL=import.validation.d.ts.map