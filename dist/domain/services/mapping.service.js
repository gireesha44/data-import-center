/**
 * Column Mapping Domain Service
 * Orchestrates mapping suggestions, manual mapping, validation, and lifecycle persistence
 */
import { ImportStateMachine } from '../state-machine/import-state-machine.js';
import { DeterministicMappingSuggestionProvider } from '../mapping/mapping-suggestion.provider.js';
import { MappingValidatorService } from '../mapping/mapping-validator.service.js';
import { ColumnNormalizer } from '../mapping/column-normalizer.js';
import { DataImportMappingEntity } from '../entities/data-import-mapping.entity.js';
import { DataImportPermission, hasPermission, hasAnyPermission } from '../../core/types/permissions.types.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/import.errors.js';
import { ImportStatus } from '../../core/types/import.types.js';
import { logger } from '../../core/logging/structured-logger.js';
import { HttpAiMappingProvider } from '../mapping/ai-mapping.provider.js';
export class MappingService {
    importRepository;
    mappingRepository;
    schemaRegistry;
    auditService;
    recordRepository;
    suggestionProvider;
    aiMappingProvider;
    constructor(importRepository, mappingRepository, schemaRegistry, auditService, recordRepository, suggestionProvider = new DeterministicMappingSuggestionProvider(), aiMappingProvider = new HttpAiMappingProvider()) {
        this.importRepository = importRepository;
        this.mappingRepository = mappingRepository;
        this.schemaRegistry = schemaRegistry;
        this.auditService = auditService;
        this.recordRepository = recordRepository;
        this.suggestionProvider = suggestionProvider;
        this.aiMappingProvider = aiMappingProvider;
    }
    /**
     * Generates automatic mapping suggestions based on parsed headers and target entity schema
     */
    async getSuggestions(context, importId) {
        if (!hasAnyPermission(context, [
            DataImportPermission.DATA_IMPORT_VIEW,
            DataImportPermission.DATA_IMPORT_MAP
        ])) {
            throw new ForbiddenError('Insufficient permissions to view mapping suggestions');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import with ID '${importId}' not found`);
        }
        const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
        if (!schema) {
            throw new ValidationError(`Target entity '${importJob.targetEntity}' is not registered in Schema Registry`);
        }
        const sourceColumns = this.extractSourceColumnsFromImport(importJob);
        const result = this.suggestionProvider.generateSuggestions(sourceColumns, schema);
        return this.aiMappingProvider.enrich(result, sourceColumns, schema);
    }
    /**
     * Retrieves the current saved mapping for an import job
     */
    async getMapping(context, importId) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
            throw new ForbiddenError('Insufficient permissions to view import mapping');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import with ID '${importId}' not found`);
        }
        const mapping = await this.mappingRepository.findByImportId(context.organizationId, importId);
        if (!mapping) {
            return { mapping: null };
        }
        const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
        const sourceColumns = this.extractSourceColumnsFromImport(importJob);
        let validation;
        if (schema) {
            const columnMappings = this.deserializeColumnMappings(mapping);
            validation = MappingValidatorService.validate(columnMappings, schema, sourceColumns);
        }
        return { mapping, validation };
    }
    /**
     * Saves or updates a column mapping definition and validates completeness
     */
    async saveMapping(context, importId, input) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_MAP)) {
            throw new ForbiddenError('Insufficient permissions to configure import mapping');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import with ID '${importId}' not found`);
        }
        // Mapping is the correction surface for row-level validation failures or reconfiguration.
        const allowedStates = [
            ImportStatus.DRAFT,
            ImportStatus.UPLOADED,
            ImportStatus.PARSED,
            ImportStatus.MAPPING,
            ImportStatus.MAPPED,
            ImportStatus.VALIDATION_FAILED,
            ImportStatus.VALIDATED
        ];
        if (!allowedStates.includes(importJob.status)) {
            throw new ValidationError(`Cannot map import in state '${importJob.status}'. Mapping is available in DRAFT, UPLOADED, PARSED, MAPPING, MAPPED, VALIDATED, or VALIDATION_FAILED states.`);
        }
        const previousState = importJob.status;
        if (ImportStateMachine.canTransition(importJob.status, ImportStatus.MAPPING)) {
            ImportStateMachine.transition(importJob, ImportStatus.MAPPING);
        }
        const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
        if (!schema) {
            throw new ValidationError(`Target entity '${importJob.targetEntity}' is not registered in Schema Registry`);
        }
        const sourceColumns = this.extractSourceColumnsFromImport(importJob);
        // Build internal ColumnMapping dictionary
        const columnMappings = {};
        for (const [sourceCol, def] of Object.entries(input.columnMappings || {})) {
            columnMappings[sourceCol] = {
                sourceColumn: sourceCol,
                targetField: def.targetField,
                mappingMethod: def.mappingMethod || 'MANUAL',
                confidence: 'HIGH',
                confidenceScore: 1.0,
                compatibility: 'COMPATIBLE',
                enabled: def.enabled !== false,
                defaultValue: def.defaultValue,
                metadata: { transformations: def.transformations || [] }
            };
        }
        // Validate the mappings
        const validation = MappingValidatorService.validate(columnMappings, schema, sourceColumns);
        // Save entity
        const existingMapping = await this.mappingRepository.findByImportId(context.organizationId, importId);
        const mappingEntity = new DataImportMappingEntity({
            id: existingMapping ? existingMapping.id : crypto.randomUUID(),
            organizationId: context.organizationId,
            importId,
            sourceColumns: sourceColumns.map((c) => ({
                index: c.index,
                header: c.originalName,
                sampleValues: c.sampleValues.map(String)
            })),
            columnMappings: this.serializeColumnMappings(columnMappings, schema),
            transformations: Object.fromEntries(Object.entries(columnMappings).map(([source, mapping]) => [
                source, Array.isArray(mapping.metadata?.transformations) ? mapping.metadata?.transformations : []
            ])),
            unmappedBehavior: input.unmappedBehavior || 'IGNORE',
            defaultValues: input.defaultValues || {},
            isValid: validation.isValid
        });
        await this.mappingRepository.save(mappingEntity);
        // Handle state transition deterministically. A failed validation is corrected
        // by the operator here, then the dataset is revalidated from MAPPED.
        let targetStatus = importJob.status;
        if (validation.isValid) {
            if (importJob.status === ImportStatus.PARSED) {
                ImportStateMachine.transition(importJob, ImportStatus.MAPPING);
            }
            if (importJob.status === ImportStatus.MAPPING) {
                ImportStateMachine.transition(importJob, ImportStatus.MAPPED);
            }
            targetStatus = importJob.status;
        }
        else {
            // PARSED and VALIDATION_FAILED are already opened to the mapping stage.
            if (importJob.status === ImportStatus.PARSED) {
                ImportStateMachine.transition(importJob, ImportStatus.MAPPING);
            }
            targetStatus = importJob.status;
        }
        // A changed mapping invalidates the previous staged validation/match result.
        // The same import draft remains intact, but stale row outcomes must not leak
        // into the next validation run.
        if (this.recordRepository) {
            await this.recordRepository.deleteByImportId(context.organizationId, importId);
        }
        await this.importRepository.update(importJob);
        // Audit Log
        await this.auditService.recordEvent({
            organizationId: context.organizationId,
            importId,
            actorUserId: context.userId,
            action: 'IMPORT_MAPPING_SAVED',
            fromState: previousState,
            toState: targetStatus,
            details: {
                totalMappings: Object.keys(columnMappings).length,
                isValid: validation.isValid,
                unmappedRequiredCount: validation.unmappedRequiredFields.length
            }
        });
        logger.info('Import mapping saved successfully', {
            importId,
            isValid: validation.isValid,
            mappedCount: validation.mappedSourceColumns.length
        });
        return { mapping: mappingEntity, validation };
    }
    /**
     * Validates a candidate mapping against entity schema without persisting
     */
    async validateMapping(context, importId, input) {
        if (!hasAnyPermission(context, [
            DataImportPermission.DATA_IMPORT_VIEW,
            DataImportPermission.DATA_IMPORT_MAP
        ])) {
            throw new ForbiddenError('Insufficient permissions to validate mapping');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import with ID '${importId}' not found`);
        }
        const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
        if (!schema) {
            throw new ValidationError(`Target entity '${importJob.targetEntity}' is not registered in Schema Registry`);
        }
        const sourceColumns = this.extractSourceColumnsFromImport(importJob);
        let columnMappings = {};
        if (input?.columnMappings) {
            for (const [sourceCol, def] of Object.entries(input.columnMappings)) {
                columnMappings[sourceCol] = {
                    sourceColumn: sourceCol,
                    targetField: def.targetField,
                    mappingMethod: def.mappingMethod || 'MANUAL',
                    confidence: 'HIGH',
                    confidenceScore: 1.0,
                    compatibility: 'COMPATIBLE',
                    enabled: def.enabled !== false,
                    defaultValue: def.defaultValue
                };
            }
        }
        else {
            const saved = await this.mappingRepository.findByImportId(context.organizationId, importId);
            if (saved) {
                columnMappings = this.deserializeColumnMappings(saved);
            }
        }
        return MappingValidatorService.validate(columnMappings, schema, sourceColumns);
    }
    /**
     * Clears saved mapping for an import job
     */
    async clearMapping(context, importId) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_MAP)) {
            throw new ForbiddenError('Insufficient permissions to clear import mapping');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import with ID '${importId}' not found`);
        }
        await this.mappingRepository.deleteByImportId(context.organizationId, importId);
        if (importJob.status === ImportStatus.MAPPED || importJob.status === ImportStatus.MAPPING) {
            importJob.status = ImportStatus.PARSED;
            await this.importRepository.update(importJob);
        }
        await this.auditService.recordEvent({
            organizationId: context.organizationId,
            importId,
            actorUserId: context.userId,
            action: 'IMPORT_MAPPING_CLEARED',
            fromState: importJob.status,
            toState: ImportStatus.PARSED,
            details: { reason: 'User cleared mapping' }
        });
    }
    /**
     * Extracts source columns from import metadata
     */
    extractSourceColumnsFromImport(importJob) {
        const fileMeta = importJob.fileMetadata;
        const headers = fileMeta?.headers || [];
        const sampleRows = fileMeta?.sampleRows || [];
        if (headers.length > 0) {
            return headers.map((h, idx) => {
                const samples = sampleRows
                    .map((r) => r[h] ?? r[ColumnNormalizer.normalize(h)])
                    .filter((v) => v !== undefined && v !== null);
                const inferredType = ColumnNormalizer.inferDataType(samples);
                return {
                    index: idx,
                    originalName: h,
                    normalizedName: ColumnNormalizer.normalize(h),
                    inferredType,
                    sampleValues: samples.slice(0, 5),
                    emptyPercentage: 0,
                    statistics: {
                        totalSamples: sampleRows.length,
                        distinctCount: new Set(samples.map(String)).size,
                        nullCount: sampleRows.length - samples.length
                    }
                };
            });
        }
        return [];
    }
    serializeColumnMappings(mappings, schema) {
        const result = {};
        for (const [col, m] of Object.entries(mappings)) {
            const field = schema.fields[m.targetField];
            result[col] = {
                sourceColumn: m.sourceColumn,
                targetField: m.targetField,
                targetType: field?.type || 'STRING',
                required: field?.required || false,
                mappingMethod: m.mappingMethod,
                defaultValue: m.defaultValue,
                transformations: Array.isArray(m.metadata?.transformations) ? m.metadata?.transformations : []
            };
        }
        return result;
    }
    deserializeColumnMappings(mappingEntity) {
        const result = {};
        for (const [col, def] of Object.entries(mappingEntity.columnMappings || {})) {
            result[col] = {
                sourceColumn: def.sourceColumn || col,
                targetField: def.targetField,
                mappingMethod: 'MANUAL',
                confidence: 'HIGH',
                confidenceScore: 1.0,
                compatibility: 'COMPATIBLE',
                enabled: true,
                defaultValue: def.defaultValue,
                metadata: { transformations: def.transformations || [] }
            };
        }
        return result;
    }
}
//# sourceMappingURL=mapping.service.js.map