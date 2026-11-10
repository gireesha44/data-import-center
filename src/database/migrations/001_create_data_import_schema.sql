-- =============================================================================
-- Migration: 001_create_data_import_schema.sql
-- Description: Core schema for Data Import Centre (Multi-tenant, Staging, Execution, Audits)
-- =============================================================================

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE import_status AS ENUM (
        'DRAFT',
        'UPLOADED',
        'PARSING',
        'PARSED',
        'MAPPING',
        'MAPPED',
        'VALIDATING',
        'VALIDATED',
        'VALIDATION_FAILED',
        'REQUIRES_APPROVAL',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'QUEUED',
        'PROCESSING',
        'COMPLETED',
        'COMPLETED_WITH_ERRORS',
        'FAILED',
        'CANCELLED',
        'RECONCILIATION_REQUIRED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE import_source_type AS ENUM (
        'FILE_UPLOAD',
        'REST_API',
        'WEBHOOK',
        'INTERNAL_QUERY',
        'SCHEDULED_SYNC'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE import_file_format AS ENUM (
        'CSV',
        'XLSX',
        'XLS',
        'JSON',
        'XML'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE record_status AS ENUM (
        'PENDING',
        'VALID',
        'INVALID',
        'WARNING',
        'DUPLICATE',
        'SKIPPED',
        'CREATED',
        'UPDATED',
        'REJECTED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE duplicate_strategy AS ENUM (
        'SKIP',
        'UPDATE',
        'REJECT',
        'MANUAL_REVIEW'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_decision AS ENUM (
        'PENDING',
        'APPROVED',
        'REJECTED',
        'CANCELLED',
        'INVALIDATED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE execution_status AS ENUM (
        'INITIALIZED',
        'IN_PROGRESS',
        'COMPLETED',
        'FAILED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Mock / Placeholder Parent Tables if not already present in environment
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table: data_import_sources
CREATE TABLE IF NOT EXISTS data_import_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source_type import_source_type NOT NULL,
    file_format import_file_format NULL,
    connection_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_import_sources_org ON data_import_sources (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_import_sources_type ON data_import_sources (organization_id, source_type);

-- 4. Table: data_imports (Master Import Job Entity)
CREATE TABLE IF NOT EXISTS data_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_id UUID NULL REFERENCES data_import_sources(id) ON DELETE SET NULL,
    target_module VARCHAR(100) NOT NULL,
    target_entity VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status import_status NOT NULL DEFAULT 'DRAFT',
    source_type import_source_type NOT NULL DEFAULT 'FILE_UPLOAD',
    file_name VARCHAR(255) NULL,
    file_size_bytes BIGINT NULL,
    file_mime_type VARCHAR(100) NULL,
    file_storage_path TEXT NULL,
    file_checksum_sha256 VARCHAR(64) NULL,
    import_options JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_records INTEGER NOT NULL DEFAULT 0,
    valid_records INTEGER NOT NULL DEFAULT 0,
    invalid_records INTEGER NOT NULL DEFAULT 0,
    warning_records INTEGER NOT NULL DEFAULT 0,
    processed_records INTEGER NOT NULL DEFAULT 0,
    failed_records INTEGER NOT NULL DEFAULT 0,
    skipped_records INTEGER NOT NULL DEFAULT 0,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_data_imports_org_status ON data_imports (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_imports_org_entity ON data_imports (organization_id, target_module, target_entity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_imports_created_by ON data_imports (organization_id, created_by);

-- 5. Table: data_import_mappings
CREATE TABLE IF NOT EXISTS data_import_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    import_id UUID NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
    source_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
    column_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
    transformations JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    unmapped_behavior VARCHAR(50) NOT NULL DEFAULT 'IGNORE',
    is_valid BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_data_import_mappings_import UNIQUE (import_id)
);

CREATE INDEX IF NOT EXISTS idx_data_import_mappings_org ON data_import_mappings (organization_id);

-- 6. Table: data_import_templates
CREATE TABLE IF NOT EXISTS data_import_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_module VARCHAR(100) NOT NULL,
    target_entity VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    column_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
    transformations JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_data_import_templates_name UNIQUE (organization_id, target_module, target_entity, name, version)
);

CREATE INDEX IF NOT EXISTS idx_data_import_templates_org_entity ON data_import_templates (organization_id, target_module, target_entity);

-- 7. Table: data_import_records (Staged Rows)
CREATE TABLE IF NOT EXISTS data_import_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    import_id UUID NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    raw_data JSONB NOT NULL,
    transformed_data JSONB NULL,
    status record_status NOT NULL DEFAULT 'PENDING',
    validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
    duplicate_match_id UUID NULL,
    duplicate_strategy duplicate_strategy NULL,
    target_record_id UUID NULL,
    execution_error TEXT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_data_import_records_row UNIQUE (import_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_data_import_records_filter ON data_import_records (organization_id, import_id, status);
CREATE INDEX IF NOT EXISTS idx_data_import_records_duplicate ON data_import_records (import_id, is_duplicate) WHERE is_duplicate = TRUE;
CREATE INDEX IF NOT EXISTS idx_data_import_records_gin_raw ON data_import_records USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_data_import_records_gin_transformed ON data_import_records USING GIN (transformed_data);

-- 8. Table: data_import_approvals
CREATE TABLE IF NOT EXISTS data_import_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    import_id UUID NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
    decision approval_decision NOT NULL DEFAULT 'PENDING',
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_by UUID NULL REFERENCES users(id),
    decided_at TIMESTAMPTZ NULL,
    reason TEXT NULL,
    snapshot_hash VARCHAR(64) NOT NULL,
    invalidation_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_import_approvals_import ON data_import_approvals (organization_id, import_id, decision);
CREATE INDEX IF NOT EXISTS idx_data_import_approvals_pending ON data_import_approvals (organization_id, decision) WHERE decision = 'PENDING';

-- 9. Table: data_import_executions
CREATE TABLE IF NOT EXISTS data_import_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    import_id UUID NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
    status execution_status NOT NULL DEFAULT 'INITIALIZED',
    worker_node_id VARCHAR(100) NULL,
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    duration_ms INTEGER NULL,
    batch_size INTEGER NOT NULL DEFAULT 500,
    total_batches INTEGER NOT NULL DEFAULT 0,
    completed_batches INTEGER NOT NULL DEFAULT 0,
    records_succeeded INTEGER NOT NULL DEFAULT 0,
    records_failed INTEGER NOT NULL DEFAULT 0,
    error_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    cancelled_by UUID NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_data_import_executions_import ON data_import_executions (organization_id, import_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_import_executions_active ON data_import_executions (status) WHERE status = 'IN_PROGRESS';

-- 10. Table: data_import_audit_logs (Immutable Append-Only Trail)
CREATE TABLE IF NOT EXISTS data_import_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    import_id UUID NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
    execution_id UUID NULL REFERENCES data_import_executions(id) ON DELETE SET NULL,
    actor_user_id UUID NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    from_state VARCHAR(50) NULL,
    to_state VARCHAR(50) NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_import_audit_logs_import ON data_import_audit_logs (organization_id, import_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_data_import_audit_logs_action ON data_import_audit_logs (organization_id, action, timestamp DESC);
