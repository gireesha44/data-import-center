import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DepartmentController } from '../../api/controllers/department.controller.js';
import { DataImportEntity } from '../../domain/entities/data-import.entity.js';
import { InMemoryDataImportRepository } from '../../infrastructure/repositories/in-memory-data-import.repository.js';
import { entitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { TemplateService } from '../../domain/services/template.service.js';
describe('DepartmentController role-scoped dashboards', () => {
    const context = {
        userId: 'hr-user',
        organizationId: 'org-role-scope',
        roles: ['hr_admin'],
        permissions: []
    };
    async function setupController() {
        const repository = new InMemoryDataImportRepository();
        await repository.create(new DataImportEntity({
            id: 'hr-import',
            organizationId: context.organizationId,
            targetModule: 'hr',
            targetEntity: 'employees',
            name: 'HR Import',
            createdBy: context.userId
        }));
        await repository.create(new DataImportEntity({
            id: 'sales-customer-import',
            organizationId: context.organizationId,
            targetModule: 'sales',
            targetEntity: 'customers',
            name: 'Sales Customer Import',
            createdBy: context.userId
        }));
        return new DepartmentController(repository, new TemplateService(entitySchemaRegistry));
    }
    it('limits global dashboard metrics and recent jobs to departments allowed for the role', async () => {
        const controller = await setupController();
        let responseBody;
        const response = {
            status() { return this; },
            json(body) { responseBody = body; return this; }
        };
        const request = {
            params: { departmentId: 'global' },
            query: { role: 'org_admin' },
            securityContext: context
        };
        await controller.getDepartmentDashboard(request, response, ((error) => { if (error)
            throw error; }));
        assert.equal(responseBody.data.metrics.totalJobs, 1);
        assert.deepEqual(responseBody.data.recentJobs.map((job) => job.id), ['hr-import']);
    });
    it('does not count an import in another module merely because its entity name is shared', async () => {
        const controller = await setupController();
        let responseBody;
        const response = {
            status() { return this; },
            json(body) { responseBody = body; return this; }
        };
        const request = {
            query: { role: 'finance_admin' },
            securityContext: { ...context, roles: ['finance_admin'] }
        };
        await controller.getDepartments(request, response, ((error) => { if (error)
            throw error; }));
        const finance = responseBody.data.find((department) => department.id === 'finance');
        assert.equal(finance.recentImportCount, 0);
    });
});
//# sourceMappingURL=department.controller.test.js.map