import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TransformationPipeline } from '../../../domain/transformation/transformation.pipeline.js';
import { entitySchemaRegistry } from '../../../core/registry/entity-schema.registry.js';
import { DataImportMappingEntity } from '../../../domain/entities/data-import-mapping.entity.js';
describe('Transformation Pipeline', () => {
    const pipeline = new TransformationPipeline();
    const contactSchema = entitySchemaRegistry.getEntity('contacts');
    const contextInfo = { organizationId: 'org_1', importId: 'imp_1' };
    it('applies default schema type transformations (trim, lowercase, uppercase)', () => {
        const rawRow = {
            first_name: '  Jane  ',
            last_name: '  Doe  ',
            email: '  Jane.Doe@Example.com  '
        };
        const mapping = new DataImportMappingEntity({
            id: 'map_1',
            organizationId: 'org_1',
            importId: 'imp_1',
            columnMappings: {
                first_name: { sourceColumn: 'first_name', targetField: 'first_name', targetType: 'STRING', required: true },
                last_name: { sourceColumn: 'last_name', targetField: 'last_name', targetType: 'STRING', required: true },
                email: { sourceColumn: 'email', targetField: 'email', targetType: 'EMAIL', required: true }
            }
        });
        const result = pipeline.transformRow(1, rawRow, mapping, contactSchema, contextInfo);
        assert.equal(result.transformedData.first_name, 'Jane');
        assert.equal(result.transformedData.last_name, 'Doe');
        assert.equal(result.transformedData.email, 'jane.doe@example.com');
    });
    it('executes custom transformations configured in mapping', () => {
        const rawRow = {
            code: '  abc-123  '
        };
        const mapping = new DataImportMappingEntity({
            id: 'map_2',
            organizationId: 'org_1',
            importId: 'imp_1',
            columnMappings: {
                code: { sourceColumn: 'code', targetField: 'sku', targetType: 'STRING', required: true }
            },
            transformations: {
                code: [
                    { type: 'UPPERCASE' },
                    { type: 'PREFIX_SUFFIX', options: { prefix: 'ITEM_' } }
                ]
            }
        });
        const productSchema = entitySchemaRegistry.getEntity('products');
        const result = pipeline.transformRow(1, rawRow, mapping, productSchema, contextInfo);
        assert.equal(result.transformedData.sku, 'ITEM_ABC-123');
    });
    it('records transformation errors on unparseable values without throwing', () => {
        const rawRow = {
            price: 'not-a-number'
        };
        const mapping = new DataImportMappingEntity({
            id: 'map_3',
            organizationId: 'org_1',
            importId: 'imp_1',
            columnMappings: {
                price: { sourceColumn: 'price', targetField: 'price', targetType: 'DECIMAL', required: true }
            }
        });
        const productSchema = entitySchemaRegistry.getEntity('products');
        const result = pipeline.transformRow(1, rawRow, mapping, productSchema, contextInfo);
        assert.ok(result.transformationErrors.price);
    });
});
//# sourceMappingURL=transformation-pipeline.test.js.map