# DATA IMPORT CENTRE — ENVIRONMENT CONFIGURATION SPECIFICATION

This document defines all environment variables required for running the Data Import Centre in development, staging, and production environments.

---

## 1. Environment Variable Matrix

| Variable | Description | Type | Required | Default / Example | Sensitivity |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `NODE_ENV` | Runtime environment mode | `string` | Yes | `production` / `development` / `test` | Low |
| `PORT` | HTTP Server port | `number` | No | `3000` | Low |
| `HOST` | HTTP Server bind address | `string` | No | `0.0.0.0` | Low |
| `DATABASE_URL` | PostgreSQL primary connection URI | `string` | Yes | `postgresql://user:pass@localhost:5432/import_db` | High (Secret) |
| `DATABASE_POOL_MIN` | Minimum database connection pool size | `number` | No | `2` | Low |
| `DATABASE_POOL_MAX` | Maximum database connection pool size | `number` | No | `20` | Low |
| `STORAGE_PROVIDER` | Ingestion storage provider backend | `enum` | No | `local` / `s3` / `gcs` (Default: `local`) | Low |
| `LOCAL_STORAGE_DIR` | Directory for temporary staging files | `string` | No | `./tmp/uploads` | Low |
| `S3_BUCKET_NAME` | S3 bucket name if using S3 storage | `string` | Conditional | `data-import-staging-prod` | Low |
| `S3_REGION` | AWS Region for S3 | `string` | Conditional | `us-east-1` | Low |
| `AWS_ACCESS_KEY_ID` | AWS Access Key | `string` | Conditional | `AKIA...` | High (Secret) |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key | `string` | Conditional | `secret` | High (Secret) |
| `MAX_FILE_SIZE_BYTES` | Maximum allowed upload size (bytes) | `number` | No | `52428800` (50 MB) | Low |
| `MAX_IMPORT_ROWS` | Maximum rows per single import job | `number` | No | `100000` | Low |
| `DEFAULT_BATCH_SIZE` | Processing / Execution batch size | `number` | No | `500` | Low |
| `MAX_RETRIES_ALLOWED`| Maximum execution retries per import | `number` | No | `3` | Low |
| `STALLED_JOB_TIMEOUT_SEC` | Seconds before executing job considered stalled | `number` | No | `1800` (30 mins) | Low |
| `RETENTION_DAYS` | Days before completed imports are purged | `number` | No | `90` | Low |
| `ENFORCE_SEPARATION_OF_DUTIES` | Disallow creator from approving own import | `boolean` | No | `true` | Low |
| `LOG_LEVEL` | Minimum log level output | `enum` | No | `info` / `debug` / `warn` / `error` | Low |

---

## 2. Production Security Guidelines
- Never check `.env` or configuration files containing credentials into source control.
- Store `DATABASE_URL` and cloud access credentials in a dedicated KMS / Secrets Manager (e.g. AWS Secrets Manager, HashiCorp Vault, Google Secret Manager).
- Ensure temporary upload storage directories (`LOCAL_STORAGE_DIR`) have strict POSIX permissions (`0700`) and are periodically swept by the `CleanupService`.
