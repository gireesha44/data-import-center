# DATA IMPORT CENTRE — DEVELOPER ONBOARDING GUIDE

Welcome to the **Data Import Centre** codebase. This guide will help you get up to speed with the architecture, local setup, test runner, debugging patterns, and how to extend the platform with new entities.

---

## 1. Quick Architecture Overview
The Data Import Centre is designed around clean architecture and domain-driven design:
- **Core (`src/core/`)**: Entity Schema Registry, Config, Error Hierarchy, Types.
- **Domain (`src/domain/`)**: Pure domain engines (`TransformationPipeline`, `ValidationEngine`, `DuplicateDetectionEngine`, `ImportStateMachine`), Entities, and Services.
- **Infrastructure (`src/infrastructure/`)**: Multi-format Parsers (CSV, Excel, JSON, XML), File Storage, Security Validators, Structured Logger, and PostgreSQL Repositories.
- **API (`src/api/`)**: Express controllers, routes, RBAC middleware, and Zod request validators.

---

## 2. Local Environment Setup

### Prerequisites
- Node.js `v20+` or `v24+`
- npm `v10+`

### Step-by-Step Setup
1. **Clone repository and install dependencies**:
   ```bash
   cd data-import-center
   npm install
   ```

2. **Verify TypeScript compilation**:
   ```bash
   npm run build
   ```

3. **Run the automated test suite**:
   ```bash
   npm test
   ```

4. **Start the local development server**:
   ```bash
   npm run dev
   # Server listens on http://127.0.0.1:3000
   ```

---

## 3. How to Add a New Importable Entity in 3 Easy Steps

To register a new entity (e.g. `invoices` or `orders`):

### Step 1: Define Entity Schema
Open `src/core/registry/entity-schema.registry.ts` and call `registerEntity`:

```typescript
entitySchemaRegistry.registerEntity({
  module: 'billing',
  entity: 'invoices',
  displayName: 'Customer Invoices',
  version: 1,
  fields: {
    invoice_number: {
      name: 'invoice_number',
      label: 'Invoice Number',
      type: 'STRING',
      required: true,
      unique: true,
      aliases: ['inv_no', 'invoice_id', 'inv_num']
    },
    amount: {
      name: 'amount',
      label: 'Invoice Amount',
      type: 'DECIMAL',
      required: true
    },
    issue_date: {
      name: 'issue_date',
      label: 'Issue Date',
      type: 'DATE',
      required: true
    }
  },
  duplicateRules: [
    {
      name: 'Invoice Number Match',
      fields: ['invoice_number'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ],
  approvalPolicy: {
    requiresApproval: true,
    thresholdRowCount: 1000
  }
});
```

### Step 2: Implement or Register Target Match Provider
In `src/infrastructure/matching/in-memory-target-match.provider.ts`:
```typescript
targetMatchProviderRegistry.registerProvider(new InMemoryTargetMatchProvider('invoices'));
```

### Step 3: Verify with Unit Tests
Add a test in `src/tests/unit/` testing your new schema mapping and validation!

---

## 4. Common Developer Troubleshooting & FAQs

### Q: Why did `/execute` return HTTP 400 with `APPROVAL_STALE`?
**A:** The import data or column mapping was modified after approval was granted. Re-approve the import to generate a new cryptographic snapshot hash.

### Q: Why did `/approve` return HTTP 403 Forbidden?
**A:** Segregation of duties prevents the import creator from approving their own import. Use a user ID with `DATA_IMPORT_APPROVE` permission that differs from `createdBy`.

### Q: How do I test with custom batch sizes?
**A:** Pass `{ "batchSize": 250 }` in the POST body to `/api/v1/data-imports/:id/execute`.
