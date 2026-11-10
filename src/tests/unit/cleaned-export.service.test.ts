import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { CleanedDataExportService } from '../../domain/services/cleaned-export.service.js';
import { DataImportEntity } from '../../domain/entities/data-import.entity.js';
import { DataImportRecordEntity } from '../../domain/entities/data-import-record.entity.js';
import { EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { DataImportPermission, SecurityContext } from '../../core/types/permissions.types.js';
import { RecordStatus } from '../../core/types/import.types.js';
import { InMemoryDataImportRepository } from '../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportRecordRepository } from '../../infrastructure/repositories/in-memory-data-import-record.repository.js';

function readDocxDocumentXml(buffer: Buffer): string {
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const filenameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const filenameStart = offset + 30;
    const filename = buffer.toString('utf8', filenameStart, filenameStart + filenameLength);
    const dataStart = filenameStart + filenameLength + extraLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

    if (filename === 'word/document.xml') {
      return (compression === 8 ? inflateRawSync(compressedData) : compressedData).toString('utf8');
    }
    offset = dataStart + compressedSize;
  }
  throw new Error('DOCX document.xml was not found');
}

describe('CleanedDataExportService tabular reports', () => {
  it('includes cleaned records in a single table in PDF and Word exports', async () => {
    const importRepository = new InMemoryDataImportRepository();
    const recordRepository = new InMemoryDataImportRecordRepository();
    const schemaRegistry = new EntitySchemaRegistry();
    schemaRegistry.registerEntity({
      module: 'hr',
      entity: 'employees',
      displayName: 'Employees',
      version: 1,
      fields: {
        employee_id: { name: 'employee_id', label: 'Employee ID', type: 'STRING', required: true },
        employee_name: { name: 'employee_name', label: 'Employee Name', type: 'STRING', required: true }
      },
      duplicateRules: []
    });

    const context: SecurityContext = {
      userId: 'report-user',
      organizationId: 'report-org',
      roles: ['hr_admin'],
      permissions: [DataImportPermission.DATA_IMPORT_VIEW]
    };
    const importJob = new DataImportEntity({
      id: 'report-import',
      organizationId: context.organizationId,
      targetModule: 'hr',
      targetEntity: 'employees',
      name: 'Employee Import',
      createdBy: context.userId
    });
    await importRepository.create(importJob);
    await recordRepository.saveBatch([
      new DataImportRecordEntity({
        id: 'report-row-1',
        organizationId: context.organizationId,
        importId: importJob.id,
        rowIndex: 1,
        rawData: { employee_id: 'E-100', employee_name: 'Mina' },
        transformedData: { employee_id: 'E-100', employee_name: 'Mina' },
        status: RecordStatus.VALID
      }),
      new DataImportRecordEntity({
        id: 'report-row-2',
        organizationId: context.organizationId,
        importId: importJob.id,
        rowIndex: 2,
        rawData: { employee_id: 'E-200', employee_name: 'Ravi' },
        transformedData: { employee_id: 'E-200', employee_name: 'Ravi' },
        status: RecordStatus.VALID
      })
    ]);

    const service = new CleanedDataExportService(importRepository, recordRepository, schemaRegistry);
    const pdf = await service.exportDataset(context, importJob.id, { format: 'pdf' });
    const pdfText = pdf.buffer.toString('latin1');
    assert.match(pdfText, /employee_id/);
    assert.match(pdfText, /employee_name/);
    assert.match(pdfText, /E-100/);
    assert.match(pdfText, /Ravi/);
    assert.doesNotMatch(pdfText, /Cleaned Record #/);

    const docx = await service.exportDataset(context, importJob.id, { format: 'docx' });
    const documentXml = readDocxDocumentXml(docx.buffer);
    assert.match(documentXml, /<w:tblHeader\/>/);
    assert.match(documentXml, /employee_id/);
    assert.match(documentXml, /employee_name/);
    assert.match(documentXml, /E-100/);
    assert.match(documentXml, /Ravi/);
    assert.doesNotMatch(documentXml, /Cleaned Record #/);
  });
});
