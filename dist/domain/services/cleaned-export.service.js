/**
 * Cleaned Data Export Domain Service
 *
 * Multi-format export generator (CSV, XLSX, PDF, DOCX) for cleaned datasets,
 * rejected records, and comprehensive import summaries.
 */
import XLSX from 'xlsx';
import { hasPermission, DataImportPermission } from '../../core/types/permissions.types.js';
import { NotFoundError, ForbiddenError } from '../../core/errors/import.errors.js';
import { RecordStatus } from '../../core/types/import.types.js';
import { MatchClassification } from '../../core/types/duplicate.types.js';
import { buildDocxDocument, buildPdfSummaryDocument } from '../../infrastructure/utils/document-export.js';
export class CleanedDataExportService {
    importRepository;
    recordRepository;
    schemaRegistry;
    storage;
    constructor(importRepository, recordRepository, schemaRegistry, storage) {
        this.importRepository = importRepository;
        this.recordRepository = recordRepository;
        this.schemaRegistry = schemaRegistry;
        this.storage = storage;
    }
    async exportDataset(context, importId, options) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
            throw new ForbiddenError('Insufficient permissions to export dataset');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job '${importId}' not found`);
        }
        const entityName = importJob.targetEntity;
        const schema = this.schemaRegistry.getEntity(entityName);
        const schemaFields = schema ? Object.values(schema.fields) : [];
        // Fetch the complete staged dataset in bounded pages. The repository deliberately caps
        // each request to a safe page size, so exporting 100k+ records must page through the
        // dataset rather than silently exporting only the first page.
        const stagedRecords = [];
        const pageSize = 500;
        let page = 1;
        let total = 0;
        do {
            const result = await this.recordRepository.findByImportId(context.organizationId, importId, { page, limit: pageSize });
            stagedRecords.push(...result.data);
            total = result.pagination.total;
            if (result.data.length === 0 || stagedRecords.length >= total)
                break;
            page += 1;
        } while (true);
        const staged = { data: stagedRecords, pagination: { total } };
        const scope = options.scope || 'cleaned';
        let excludedDuplicatesCount = 0;
        let excludedInvalidCount = 0;
        let targetRecords = staged.data.filter((r) => {
            const isExplicitUpdate = r.executionAction === 'UPDATE';
            const isDuplicate = !isExplicitUpdate && (r.matchClassification === MatchClassification.DUPLICATE_IN_FILE ||
                r.status === RecordStatus.SKIPPED_DUPLICATE ||
                r.executionAction === 'SKIP');
            if (isDuplicate)
                excludedDuplicatesCount++;
            if (scope === 'cleaned') {
                const isValid = r.status === RecordStatus.VALID ||
                    r.status === RecordStatus.READY_FOR_IMPORT ||
                    r.status === RecordStatus.CREATED ||
                    r.status === RecordStatus.UPDATED ||
                    r.status === RecordStatus.AUTO_CORRECTED ||
                    r.status === RecordStatus.WARNING;
                if (!isValid && !isDuplicate)
                    excludedInvalidCount++;
                return isValid && !isDuplicate;
            }
            else if (scope === 'rejected') {
                return (r.status === RecordStatus.INVALID ||
                    r.status === RecordStatus.FAILED ||
                    r.status === RecordStatus.REJECTED);
            }
            return true;
        });
        // Extract target column definitions
        let exportColumns = options.columns && options.columns.length > 0 ? options.columns : [];
        if (exportColumns.length === 0) {
            if (schemaFields.length > 0) {
                exportColumns = schemaFields.map((f) => f.name);
            }
            else if (targetRecords.length > 0 && targetRecords[0].transformedData) {
                exportColumns = Object.keys(targetRecords[0].transformedData);
            }
        }
        // Prepare cleaned row objects
        const rowDataArray = targetRecords.map((r) => {
            const source = r.transformedData || r.rawData || {};
            const row = {};
            for (const col of exportColumns) {
                let val = source[col];
                if (val === undefined || val === null)
                    val = '';
                row[col] = val;
            }
            return row;
        });
        const dateStr = new Date().toISOString().split('T')[0];
        const baseFilename = `${entityName}_${scope}_${dateStr}`;
        const format = options.format.toLowerCase();
        let resultBuffer;
        let contentType;
        let filename;
        switch (format) {
            case 'csv':
                resultBuffer = this.generateCsv(rowDataArray, exportColumns);
                contentType = 'text/csv';
                filename = `${baseFilename}.csv`;
                break;
            case 'xlsx':
                resultBuffer = this.generateXlsx(rowDataArray, exportColumns, entityName);
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                filename = `${baseFilename}.xlsx`;
                break;
            case 'pdf':
                resultBuffer = this.generatePdfReport(importJob, rowDataArray, exportColumns, {
                    totalRecords: staged.pagination.total,
                    validRecords: targetRecords.length,
                    excludedDuplicates: excludedDuplicatesCount,
                    excludedInvalid: excludedInvalidCount,
                    scope
                });
                contentType = 'application/pdf';
                filename = `${baseFilename}_report.pdf`;
                break;
            case 'docx':
                resultBuffer = this.generateDocxReport(importJob, rowDataArray, exportColumns, {
                    totalRecords: staged.pagination.total,
                    validRecords: targetRecords.length,
                    excludedDuplicates: excludedDuplicatesCount,
                    excludedInvalid: excludedInvalidCount,
                    scope
                });
                contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                filename = `${baseFilename}_report.docx`;
                break;
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
        return {
            contentType,
            filename,
            buffer: resultBuffer,
            recordCount: targetRecords.length,
            excludedDuplicatesCount,
            excludedInvalidCount
        };
    }
    generateCsv(rows, columns) {
        if (rows.length === 0) {
            return Buffer.from(columns.join(',') + '\n', 'utf-8');
        }
        const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);
        return Buffer.from(csvContent, 'utf-8');
    }
    generateXlsx(rows, columns, entityName) {
        const workbook = XLSX.utils.book_new();
        const sheetName = entityName.substring(0, 31) || 'Cleaned Data';
        const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
        // Auto-fit column widths
        const colWidths = columns.map((col) => {
            let maxLen = col.length;
            for (const row of rows) {
                const valStr = String(row[col] ?? '');
                if (valStr.length > maxLen)
                    maxLen = Math.min(valStr.length, 50);
            }
            return { wch: maxLen + 4 };
        });
        worksheet['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return buf;
    }
    generatePdfReport(importJob, rows, columns, stats) {
        const generated = new Date().toISOString();
        const sections = [
            {
                heading: 'Import Overview',
                rows: [
                    ['Import ID', String(importJob.id || '—')],
                    ['Module', String(importJob.targetModule || '—')],
                    ['Entity', String(importJob.targetEntity || '—')],
                    ['Source File', String(importJob.fileMetadata?.fileName || importJob.name || '—')],
                    ['Generated', generated]
                ]
            },
            {
                heading: 'Cleaned Dataset Overview',
                rows: [
                    ['Source Rows', Number(stats.totalRecords || 0).toLocaleString()],
                    ['Cleaned Rows Exported', Number(rows.length).toLocaleString()],
                    ['Columns', Number(columns.length).toLocaleString()],
                    ['Duplicate Rows Excluded', Number(stats.excludedDuplicates || 0).toLocaleString()],
                    ['Invalid / Rejected Rows Excluded', Number(stats.excludedInvalid || 0).toLocaleString()]
                ]
            }
        ];
        sections.push({
            heading: 'Cleaned Dataset',
            rows: [],
            table: {
                columns,
                rows: rows.map((row) => columns.map((column) => {
                    const value = row[column];
                    return value !== undefined && value !== null && String(value).trim() !== '' ? String(value) : '—';
                }))
            }
        });
        return buildPdfSummaryDocument('BOSS Data Import Centre — Cleaned Dataset Report', sections);
    }
    generateDocxReport(importJob, rows, columns, stats) {
        const sections = [
            {
                heading: 'Import Overview',
                rows: [
                    ['Import ID', String(importJob.id || '—')],
                    ['Entity', String(importJob.targetEntity || '—')],
                    ['Module', String(importJob.targetModule || '—')],
                    ['Source File', String(importJob.fileMetadata?.fileName || importJob.name || '—')],
                    ['Generated', new Date().toISOString()]
                ]
            },
            {
                heading: 'Cleaned Dataset Overview',
                rows: [
                    ['Source rows', Number(stats.totalRecords ?? 0).toLocaleString()],
                    ['Cleaned rows exported', Number(rows.length).toLocaleString()],
                    ['Columns', Number(columns.length).toLocaleString()],
                    ['Duplicates excluded', Number(stats.excludedDuplicates ?? 0).toLocaleString()],
                    ['Invalid rows excluded', Number(stats.excludedInvalid ?? 0).toLocaleString()]
                ]
            }
        ];
        sections.push({
            heading: 'Cleaned Dataset',
            rows: [],
            table: {
                columns,
                rows: rows.map((row) => columns.map((column) => {
                    const value = row[column];
                    return value !== undefined && value !== null && String(value).trim() !== '' ? String(value) : '—';
                }))
            }
        });
        return buildDocxDocument('BOSS Data Import Centre — Cleaned Dataset Report', sections);
    }
}
//# sourceMappingURL=cleaned-export.service.js.map