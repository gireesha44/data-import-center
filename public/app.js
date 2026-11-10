/**
 * Data Import Centre — Frontend Application Controller
 * High-performance vanilla JavaScript single page application
 */

// Application State
const state = {
  activeView: 'dashboard',
  currentStep: 1,
  currentImportId: null,
  currentImport: null,
  activeDepartment: null,
  authorizedDepartments: [],
  entities: [],
  selectedEntitySchema: null,
  selectedFile: null,
  parsedDataset: null,
  columnMappings: [],
  currentMapping: null,
  validationResult: null,
  stagedRecords: [],
  stagedRecordsFilter: 'ALL',
  duplicateResult: null,
  resolvedDuplicateRecords: [],
  reviewSummary: null,
  executionResult: null,
  reconciliationResult: null,
  importsList: [],
  auditLogs: [],
  userContext: {
    organizationId: 'org-master-101',
    organizationName: 'BOSS',
    userId: 'user-admin-01',
    role: 'ADMIN',
    permissions: [
      'DATA_IMPORT_VIEW',
      'DATA_IMPORT_CREATE',
      'DATA_IMPORT_UPLOAD',
      'DATA_IMPORT_MAP',
      'DATA_IMPORT_VALIDATE',
      'DATA_IMPORT_APPROVE',
      'DATA_IMPORT_EXECUTE',
      'DATA_IMPORT_CANCEL'
    ]
  }
};

function hasPermission(permission) {
  return state.userContext.permissions.includes(permission);
}

function roleHeaderValue(role) {
  // The UI exposes the eight documented enterprise business roles directly.
  // The backend now understands the same role identifiers, so do not silently
  // collapse HR/Finance/Procurement/etc. into a generic operator role.
  return String(role || '').toLowerCase();
}

const BUSINESS_ROLE_PROFILES = {
  org_admin: { userId: 'user-org-admin-01', permissions: [
    'DATA_IMPORT_VIEW', 'DATA_IMPORT_CREATE', 'DATA_IMPORT_UPLOAD', 'DATA_IMPORT_MAP',
    'DATA_IMPORT_VALIDATE', 'DATA_IMPORT_APPROVE', 'DATA_IMPORT_EXECUTE', 'DATA_IMPORT_CANCEL',
    'DATA_IMPORT_RETRY', 'DATA_IMPORT_VIEW_SENSITIVE', 'DATA_IMPORT_MANAGE_SOURCES',
    'DATA_IMPORT_MANAGE_TEMPLATES', 'DATA_IMPORT_VIEW_AUDIT'
  ] },
  hr_admin: { userId: 'user-hr-admin-01', permissions: [
    'DATA_IMPORT_VIEW', 'DATA_IMPORT_CREATE', 'DATA_IMPORT_UPLOAD', 'DATA_IMPORT_MAP',
    'DATA_IMPORT_VALIDATE', 'DATA_IMPORT_APPROVE', 'DATA_IMPORT_EXECUTE', 'DATA_IMPORT_CANCEL',
    'DATA_IMPORT_RETRY', 'DATA_IMPORT_VIEW_SENSITIVE', 'DATA_IMPORT_VIEW_AUDIT'
  ] },
  finance_admin: { userId: 'user-finance-admin-01', permissions: [
    'DATA_IMPORT_VIEW', 'DATA_IMPORT_CREATE', 'DATA_IMPORT_UPLOAD', 'DATA_IMPORT_MAP',
    'DATA_IMPORT_VALIDATE', 'DATA_IMPORT_APPROVE', 'DATA_IMPORT_EXECUTE', 'DATA_IMPORT_CANCEL',
    'DATA_IMPORT_RETRY', 'DATA_IMPORT_VIEW_SENSITIVE', 'DATA_IMPORT_VIEW_AUDIT'
  ] },
  procurement_manager: { userId: 'user-procurement-manager-01', permissions: [
    'DATA_IMPORT_VIEW', 'DATA_IMPORT_CREATE', 'DATA_IMPORT_UPLOAD', 'DATA_IMPORT_MAP',
    'DATA_IMPORT_VALIDATE', 'DATA_IMPORT_APPROVE', 'DATA_IMPORT_EXECUTE', 'DATA_IMPORT_CANCEL',
    'DATA_IMPORT_RETRY', 'DATA_IMPORT_VIEW_SENSITIVE', 'DATA_IMPORT_VIEW_AUDIT'
  ] },
  sales_manager: { userId: 'user-sales-manager-01', permissions: [
    'DATA_IMPORT_VIEW', 'DATA_IMPORT_CREATE', 'DATA_IMPORT_UPLOAD', 'DATA_IMPORT_MAP',
    'DATA_IMPORT_VALIDATE', 'DATA_IMPORT_APPROVE', 'DATA_IMPORT_EXECUTE', 'DATA_IMPORT_CANCEL',
    'DATA_IMPORT_RETRY', 'DATA_IMPORT_VIEW_SENSITIVE', 'DATA_IMPORT_VIEW_AUDIT'
  ] },
  compliance_manager: { userId: 'user-compliance-manager-01', permissions: [
    'DATA_IMPORT_VIEW', 'DATA_IMPORT_CREATE', 'DATA_IMPORT_UPLOAD', 'DATA_IMPORT_MAP',
    'DATA_IMPORT_VALIDATE', 'DATA_IMPORT_APPROVE', 'DATA_IMPORT_EXECUTE', 'DATA_IMPORT_CANCEL',
    'DATA_IMPORT_RETRY', 'DATA_IMPORT_VIEW_SENSITIVE', 'DATA_IMPORT_VIEW_AUDIT'
  ] },
  project_manager: { userId: 'user-project-manager-01', permissions: [
    'DATA_IMPORT_VIEW', 'DATA_IMPORT_CREATE', 'DATA_IMPORT_UPLOAD', 'DATA_IMPORT_MAP',
    'DATA_IMPORT_VALIDATE', 'DATA_IMPORT_APPROVE', 'DATA_IMPORT_EXECUTE', 'DATA_IMPORT_CANCEL',
    'DATA_IMPORT_RETRY', 'DATA_IMPORT_VIEW_SENSITIVE', 'DATA_IMPORT_VIEW_AUDIT'
  ] },
  employee: { userId: 'user-employee-01', permissions: [
    'DATA_IMPORT_VIEW', 'DATA_IMPORT_CREATE', 'DATA_IMPORT_UPLOAD', 'DATA_IMPORT_VALIDATE', 'DATA_IMPORT_CANCEL'
  ] }
};

function applyRoleAwareUi() {
  const canCreate = hasPermission('DATA_IMPORT_CREATE');
  const canUpload = hasPermission('DATA_IMPORT_UPLOAD');
  const canMap = hasPermission('DATA_IMPORT_MAP');
  const canValidate = hasPermission('DATA_IMPORT_VALIDATE');
  const canApprove = hasPermission('DATA_IMPORT_APPROVE');
  const canExecute = hasPermission('DATA_IMPORT_EXECUTE');
  const approveButton = document.getElementById('btn-approve-import');
  const rejectButton = document.getElementById('btn-reject-import');
  const executeButton = document.getElementById('btn-step8-execute');
  const nextApprovalButton = document.getElementById('btn-step7-next');
  const notice = document.getElementById('approval-permission-notice');

  if (approveButton) approveButton.style.display = canApprove ? '' : 'none';
  if (rejectButton) rejectButton.style.display = canApprove ? '' : 'none';
  if (executeButton) executeButton.style.display = canExecute ? '' : 'none';
  for (const id of ['btn-start-new-import', 'empty-create-btn', 'btn-step1-next']) {
    const el = document.getElementById(id);
    if (el) el.style.display = canCreate ? '' : 'none';
  }
  const uploadButton = document.getElementById('btn-step2-upload');
  if (uploadButton) uploadButton.disabled = !canUpload;
  for (const id of ['btn-step3-validate-mapping', 'btn-run-dataset-validation', 'btn-step4-next', 'btn-run-duplicate-check']) {
    const el = document.getElementById(id);
    if (el) el.disabled = !canValidate;
  }
  const saveMappingButton = document.getElementById('btn-step3-save');
  if (saveMappingButton) saveMappingButton.disabled = !canMap;
  const saveOptionsButton = document.getElementById('btn-save-import-options');
  if (saveOptionsButton) saveOptionsButton.disabled = !canCreate;
  if (nextApprovalButton) nextApprovalButton.disabled = !canExecute || state.reviewSummary?.approvalStatus !== 'APPROVED';

  if (notice) {
    if (state.reviewSummary?.approvalStatus === 'PENDING') {
      notice.style.display = '';
      notice.textContent = `Request assigned to ${state.reviewSummary.approverLabel || state.reviewSummary.assignedApproverRole || 'the configured approver'}.`;
    } else if (!canApprove) {
      notice.style.display = '';
      notice.textContent = 'Only a user with the assigned business role and approval permission can decide this request.';
    } else {
      notice.style.display = 'none';
      notice.textContent = '';
    }
  }
}

// API Client Wrapper with Security Context Headers
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'x-organization-id': state.userContext.organizationId,
    'x-user-id': state.userContext.userId,
    'x-user-roles': roleHeaderValue(state.userContext.role),
    'x-user-permissions': state.userContext.permissions.join(','),
    ...options.headers
  };

  // Only add Content-Type JSON if not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const url = endpoint.startsWith('http') ? endpoint : `/api/v1/data-imports${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const raw = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMsg =
        raw?.error?.message ||
        (Array.isArray(raw?.error?.details) ? raw.error.details.map(d => d.message || String(d)).join(', ') : '') ||
        raw?.message ||
        (typeof raw?.error === 'string' ? raw.error : '') ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    // Unwrap the backend { success, data } envelope if present
    if (raw && typeof raw === 'object' && raw.success === true && 'data' in raw) {
      return raw.data;
    }

    return raw;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

// Toast Notification Manager
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="toast-msg">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Format Helper
function formatDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// View Router
function switchView(viewName) {
  if (['dashboard', 'schemas', 'audit', 'wizard'].includes(viewName) && !state.activeDepartment) {
    showToast('Please select an authorized department data centre first.', 'info');
    viewName = 'landing';
  }

  state.activeView = viewName;
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const activePanel = document.getElementById(`view-${viewName}`);
  if (activePanel) activePanel.classList.add('active');

  const activeBtn = document.querySelector(`.nav-btn[data-view="${viewName}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  if (viewName === 'dashboard') {
    loadDashboard();
  } else if (viewName === 'schemas') {
    loadSchemasView();
  } else if (viewName === 'audit') {
    loadAuditLogsView();
  } else if (viewName === 'landing') {
    loadGlobalLanding();
  } else if (viewName === 'wizard') {
    if (!state.currentImportId || state.currentImport?.targetModule !== state.activeDepartment?.id) {
      startNewImportWorkflow();
    }
  }
}

// -----------------------------------------------------------------------------
// AUTHORITATIVE CROSS-STEP WORKFLOW STATISTICS
// (Compact stat strip removed — summary cards below each step already show
//  Rows, Columns, Valid, Warnings, Invalid, etc. — no need to duplicate.)
// -----------------------------------------------------------------------------
function ensureWorkflowStatsStrips() {
  // Remove any previously-injected strips from all steps.
  for (let step = 2; step <= 10; step++) {
    const panel = document.getElementById(`wizard-step-${step}`);
    if (!panel) continue;
    panel.querySelectorAll('.workflow-live-stats').forEach((el) => el.remove());
  }
}

function formatWorkflowNumber(value) {
  return value === undefined || value === null ? '—' : Number(value).toLocaleString();
}

function renderWorkflowStats(snapshot) {
  const rows = snapshot?.rows || {};
  const columns = snapshot?.columns ?? 0;
  const values = {
    total: rows.total,
    columns,
    valid: rows.valid,
    warnings: rows.warnings,
    invalid: rows.invalid,
    corrected: rows.corrected,
    duplicates: rows.duplicates,
    inserted: rows.inserted,
    updated: rows.updated,
    outcomes: `${formatWorkflowNumber(rows.failed)} / ${formatWorkflowNumber(rows.skipped)}`
  };

  document.querySelectorAll('.workflow-live-stats').forEach(strip => {
    Object.entries(values).forEach(([key, value]) => {
      const el = strip.querySelector(`[data-workflow-stat="${key}"]`);
      if (el) el.textContent = typeof value === 'string' ? value : formatWorkflowNumber(value);
    });
  });

  // Keep the existing step-specific counters synchronized with exactly the same
  // backend snapshot. These are not independently calculated by the browser.
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatWorkflowNumber(value);
  };
  set('val-stat-total', rows.total);
  set('val-stat-valid', rows.valid);
  set('val-stat-warning', rows.warnings);
  set('val-stat-invalid', rows.invalid);
  set('filter-cnt-all', rows.total);
  set('filter-cnt-valid', rows.valid);
  set('filter-cnt-invalid', rows.invalid);
  set('filter-cnt-warning', rows.warnings);

  const planned = snapshot?.planned || {};
  if (state.currentStep !== 5 && !state.duplicateResult) {
    set('match-cnt-new', rows.newRecords);
    set('match-cnt-matched', rows.matchedRecords);
    set('match-cnt-infile', rows.duplicates);
    set('match-cnt-skipped', planned.skips ?? rows.skipped);
    set('match-cnt-review', planned.unresolved ?? planned.blocked ?? rows.blocked);
  } else if (state.duplicateResult) {
    renderMatchingCounters(state.duplicateResult);
  } else if (state.currentImport?.fileMetadata?.duplicateSummary) {
    renderMatchingCounters(state.currentImport.fileMetadata.duplicateSummary);
  }

  set('exec-metric-success', Number(rows.inserted || 0) + Number(rows.updated || 0));
  set('exec-metric-failed', rows.failed);
  renderExecutionMetrics();
  if (state.currentStep === 8) syncExecutionUi();
  const duration = snapshot?.execution?.durationMs;
  const durationEl = document.getElementById('exec-metric-duration');
  if (durationEl) durationEl.textContent = duration === undefined || duration === null ? '—' : `${Number(duration).toLocaleString()} ms`;

  // Reconciliation screen is also driven from the same snapshot when available.
  const recon = snapshot?.reconciliation;
  if (recon) {
    const reconValues = {
      'recon-source-rows': recon.sourceRows,
      'recon-source-columns': recon.sourceColumns,
      'recon-validated-rows': recon.validatedRows,
      'recon-warning-rows': recon.warningRows,
      'recon-invalid-rows': recon.invalidRows,
      'recon-corrected-rows': recon.correctedRows,
      'recon-duplicate-rows': recon.duplicateRows,
      'recon-target-created': recon.createdRecords,
      'recon-target-updated': recon.updatedRecords,
      'recon-target-skipped': recon.skippedRecords,
      'recon-target-blocked': recon.blockedRecords,
      'recon-target-failed': recon.failedRecords,
      'recon-source-rows-table': recon.sourceRows,
      'recon-created-table': recon.createdRecords,
      'recon-updated-table': recon.updatedRecords,
      'recon-skipped-table': recon.skippedRecords,
      'recon-blocked-table': recon.blockedRecords,
      'recon-failed-table': recon.failedRecords
    };
    Object.entries(reconValues).forEach(([id, value]) => set(id, value));
  }
}

async function refreshWorkflowStats() {
  if (!state.currentImportId) return;
  ensureWorkflowStatsStrips();
  try {
    const snapshot = await apiRequest(`/${state.currentImportId}/workflow-summary`);
    state.workflowStats = snapshot;
    if (state.currentImport) {
      state.currentImport.status = snapshot.state || state.currentImport.status;
      state.currentImport.totalRecords = snapshot.rows?.total ?? state.currentImport.totalRecords;
      state.currentImport.validRecords = snapshot.rows?.valid ?? state.currentImport.validRecords;
      state.currentImport.invalidRecords = snapshot.rows?.invalid ?? state.currentImport.invalidRecords;
      state.currentImport.warningRecords = snapshot.rows?.warnings ?? state.currentImport.warningRecords;
      state.currentImport.processedRecords = Number(snapshot.rows?.inserted || 0) + Number(snapshot.rows?.updated || 0);
      state.currentImport.failedRecords = snapshot.rows?.failed ?? state.currentImport.failedRecords;
      state.currentImport.skippedRecords = snapshot.rows?.skipped ?? state.currentImport.skippedRecords;
    }
    renderWorkflowStats(snapshot);
  } catch (err) {
    // Do not replace real values with zeros when the statistics request is still
    // loading or temporarily unavailable. Existing screen values remain intact.
    console.warn('Workflow statistics refresh failed:', err.message);
  }
}

// Wizard Step Router
function goToWizardStep(stepNumber, allowPreviousStep = false) {
  clearCurrentStepDirty();
  // The backend lifecycle is authoritative. Never render a later workflow step
  // while the import is still in an earlier state. This prevents the exact
  // MAPPING + Validation mismatch that previously produced misleading zeroes.
  const status = state.currentImport?.status;
  if (!allowPreviousStep && stepNumber === 4 && ['PARSED', 'MAPPING'].includes(status)) {
    stepNumber = 3;
  }
  if (!allowPreviousStep && stepNumber === 5 && !['VALIDATED', 'MATCHING'].includes(status)) {
    stepNumber = status === 'VALIDATING' || status === 'VALIDATION_FAILED' ? 4 : 3;
  }
  // Execution is never a free-navigation screen. It is reachable only after
  // approval, or when the configured policy explicitly requires no approval.
  if (!allowPreviousStep && stepNumber === 8) {
    const approvalRequired = Boolean(state.reviewSummary?.requiresApproval);
    const approvalSatisfied = state.reviewSummary?.approvalStatus === 'APPROVED' || status === 'APPROVED';
    const noApprovalGate = state.reviewSummary && !approvalRequired;
    const executionAllowed = ['APPROVED', 'QUEUED', 'PROCESSING'].includes(status) || noApprovalGate;
    if (!executionAllowed || (approvalRequired && !approvalSatisfied)) {
      stepNumber = approvalRequired ? 7 : (state.reviewSummary ? 6 : 5);
    }
  }
  if (!allowPreviousStep && stepNumber === 9 && !['COMPLETED', 'COMPLETED_WITH_ERRORS', 'RECONCILIATION_REQUIRED'].includes(status)) {
    stepNumber = 8;
  }
  if (!allowPreviousStep && stepNumber === 10 && !['COMPLETED', 'COMPLETED_WITH_ERRORS', 'RECONCILIATION_REQUIRED'].includes(status)) {
    stepNumber = 9;
  }

  state.currentStep = stepNumber;
  if (state.currentImportId) {
    window.localStorage.setItem('dataImport.currentImportId', state.currentImportId);
    window.localStorage.setItem('dataImport.currentStep', String(stepNumber));
  }

  // Update Stepper UI
  for (let i = 1; i <= 10; i++) {
    const node = document.getElementById(`step-node-${i}`);
    if (!node) continue;
    node.classList.remove('active', 'completed');
    if (i === stepNumber) {
      node.classList.add('active');
    } else if (i < stepNumber && !(i === 7 && state.reviewSummary && !state.reviewSummary.requiresApproval)) {
      node.classList.add('completed');
    }
  }

  // Update Step Panels
  document.querySelectorAll('.wizard-step-panel').forEach(p => p.classList.remove('active'));
  const targetStepPanel = document.getElementById(`wizard-step-${stepNumber}`);
  if (targetStepPanel) targetStepPanel.classList.add('active');
  if (stepNumber === 5) {
    const persistedSummary = state.currentImport?.fileMetadata?.duplicateSummary;
    if (persistedSummary && (persistedSummary.duplicateGroups?.length > 0 || persistedSummary.resolvedDuplicateGroups?.length > 0)) {
      state.duplicateResult = persistedSummary;
      renderMatchingCounters(persistedSummary);
      renderDuplicateGroups([
        ...(persistedSummary.duplicateGroups || []),
        ...(persistedSummary.resolvedDuplicateGroups || [])
      ]);
      const emptyState = document.getElementById('duplicate-empty-state');
      const findingsContainer = document.getElementById('duplicate-findings-container');
      if (emptyState) emptyState.style.display = 'none';
      if (findingsContainer) findingsContainer.style.display = 'block';
    } else {
      resetStep5DuplicateUi();
    }
  }
  if (stepNumber === 8) syncExecutionUi();

  // Step 2 is the source-file boundary. When entering it for a draft that has
  // no persisted file and no local file selection, ensure the UI is empty rather
  // than showing a stale file from another import. For an uploaded import, the
  // persisted file metadata remains visible.
  if (stepNumber === 2 && !state.currentImport?.fileName && !state.selectedFile) {
    clearStep2FileUi();
  }

  // Every wizard screen consumes the same backend statistics snapshot.
  refreshWorkflowStats();

  // Update Active Job Header
  const activeJobBar = document.getElementById('active-job-bar');
  if (state.currentImport) {
    activeJobBar.style.display = 'flex';
    document.getElementById('active-job-name').textContent = state.currentImport.name || 'Untitled Import';
    const badge = document.getElementById('active-job-status-badge');
    badge.textContent = state.currentImport.status || 'DRAFT';
    badge.className = `badge badge-${getStatusBadgeClass(state.currentImport.status)}`;
    document.getElementById('active-job-id-pill').textContent = `ID: ${state.currentImport.id.slice(0, 8)}...`;
  } else {
    activeJobBar.style.display = 'none';
  }

  setupDraftAwareWizardBacks();
}

async function hydrateWizardForStatus(importJob, preferredStep = 1) {
  state.currentImport = importJob;
  const status = importJob.status;
  if (status === 'DRAFT' || status === 'FAILED') {
    const savedStep = Number(importJob.importOptions?.customOptions?.savedWizardStep || preferredStep || 2);
    const safeStep = Math.min(10, Math.max(2, savedStep));
    if (safeStep === 2 && importJob.fileName) showExistingFileOnStep2(importJob);
    if (safeStep >= 3) { try { await loadMappingSuggestions(); } catch (_) {} }
    if (safeStep >= 4) { try { await loadValidationState(); } catch (_) {} }
    // A saved draft intentionally resumes at the last persisted wizard step,
    // which can be ahead of the import's lifecycle status (for example, Step 5
    // after leaving Review). Do not route that saved position back to Mapping.
    goToWizardStep(safeStep, true);
    return;
  }
  if (status === 'UPLOADED' || status === 'PARSING') {
    // Show existing file info on step 2 so user knows they have a file
    showExistingFileOnStep2(importJob);
    goToWizardStep(2);
    return;
  }
  if (status === 'PARSED') {
    // PARSED is the explicit inspection checkpoint. On refresh/resume, keep the
    // user on Step 2 so detected columns can be inspected before mapping.
    showExistingFileOnStep2(importJob);
    goToWizardStep(2);
    return;
  }
  if (status === 'MAPPING' || status === 'MAPPED') {
    // Once mapping has actually started/saved, Step 3 is the authoritative UI.
    // Never allow a stale saved step to open Validation while the backend is MAPPING.
    showExistingFileOnStep2(importJob);
    try { await loadMappingSuggestions(); } catch (_) {}
    goToWizardStep(3);
    return;
  }
  if (status === 'VALIDATING' || status === 'VALIDATION_FAILED') {
    showExistingFileOnStep2(importJob);
    try { await loadValidationState(); } catch (_) {}
    goToWizardStep(4);
    return;
  }
  if (status === 'VALIDATED') {
    showExistingFileOnStep2(importJob);
    try { await loadValidationState(); } catch (_) {}
    await loadReviewSummary();
    const approvalRequired = Boolean(state.reviewSummary?.requiresApproval);
    const resumeStep = preferredStep >= 8 && !approvalRequired
      ? 8
      : preferredStep >= 7 && approvalRequired
        ? 7
        : preferredStep >= 6
          ? 6
          : 5;
    goToWizardStep(resumeStep);
    return;
  }
  // MATCHING = transient state during duplicate detection scan; treat as step 5
  if (status === 'MATCHING') {
    showExistingFileOnStep2(importJob);
    try { await loadValidationState(); } catch (_) {}
    goToWizardStep(5);
    return;
  }
  if (['REQUIRES_APPROVAL', 'PENDING_APPROVAL', 'APPROVED'].includes(status)) {
    await loadReviewSummary();
    goToWizardStep(status === 'APPROVED' ? 8 : 7);
    return;
  }
  if (['QUEUED', 'PROCESSING'].includes(status)) {
    goToWizardStep(8);
    return;
  }
  if (['COMPLETED', 'COMPLETED_WITH_ERRORS', 'RECONCILIATION_REQUIRED'].includes(status)) {
    goToWizardStep(10);
    return;
  }
  goToWizardStep(1);
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'COMPLETED': return 'success';
    case 'VALIDATED': case 'APPROVED': return 'info';
    case 'PROCESSING': case 'VALIDATING': case 'PARSING': return 'purple';
    case 'MATCHING': return 'purple'; // transient state during duplicate scanning
    case 'VALIDATION_FAILED': case 'FAILED': case 'REJECTED': return 'danger';
    case 'MAPPING': case 'MAPPED': return 'warning';
    default: return 'neutral';
  }
}


// =============================================================================
// INITIALIZATION & EVENT LISTENERS
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigationEvents();
  setupRoleSelectorEvents();
  setupDashboardEvents();
  setupWizardEvents();
  setupDraftAwareWizardBacks();
  ensureWorkflowStatsStrips();
  applyRoleAwareUi();

  // Initial Data Load
  try {
    await checkHealth();

    // A fresh page load always starts at the global department chooser.
    // Keep backend drafts intact, but require the user to explicitly select
    // a department before opening its dashboard or resuming import work.
    state.activeDepartment = null;
    state.authorizedDepartments = [];
    resetWizardUiState();
    window.localStorage.removeItem('dataImport.activeDepartmentId');
    updateHeaderDepartmentContext();
    switchView('landing');
  } catch (err) {
    showToast('Failed to initialize: ' + err.message, 'error');
  }
});

async function checkHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    const pill = document.getElementById('system-health-pill');
    if (pill && data.status === 'OK') {
      pill.innerHTML = `<span class="status-dot online"></span><span class="health-label">API Online</span>`;
    }
  } catch (err) {
    const pill = document.getElementById('system-health-pill');
    if (pill) {
      pill.innerHTML = `<span class="status-dot" style="background:#ef4444;"></span><span class="health-label">API Offline</span>`;
    }
  }
}

function setupNavigationEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });

  document.getElementById('btn-start-new-import')?.addEventListener('click', () => {
    startNewImportWorkflow();
  });

  document.getElementById('empty-create-btn')?.addEventListener('click', () => {
    startNewImportWorkflow();
  });

  document.getElementById('btn-exit-to-dashboard')?.addEventListener('click', () => {
    switchView('dashboard');
  });

  document.getElementById('btn-finish-wizard')?.addEventListener('click', () => {
    switchView('dashboard');
  });

  document.getElementById('btn-cancel-active-job')?.addEventListener('click', async () => {
    if (!state.currentImportId) return;
    if (confirm('Are you sure you want to cancel this import job?')) {
      try {
        await apiRequest(`/${state.currentImportId}/cancel`, { method: 'POST' });
        showToast('Import job cancelled', 'info');
        switchView('dashboard');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });
}

function setupRoleSelectorEvents() {
  const roleSelect = document.getElementById('user-role-select');
  roleSelect?.addEventListener('change', async (e) => {
    const role = String(e.target.value || 'employee').toLowerCase();
    const profile = BUSINESS_ROLE_PROFILES[role] || BUSINESS_ROLE_PROFILES.employee;

    state.userContext.role = role;
    state.userContext.permissions = [...profile.permissions];
    state.userContext.userId = profile.userId;

    showToast(`Context switched to role: ${role.replaceAll('_', ' ')} (${state.userContext.userId})`, 'info');
    applyRoleAwareUi();

    // Invalidate and clear stale active department, import, and job list state completely
    state.activeDepartment = null;
    resetWizardUiState();
    state.importsList = [];
    state.entities = [];
    window.localStorage.removeItem('dataImport.activeDepartmentId');

    updateHeaderDepartmentContext();

    // Re-fetch authorized departments for the newly selected role
    const roleParam = encodeURIComponent(state.userContext.role || 'org_admin');
    try {
      const departments = await apiRequest(`/departments?role=${roleParam}`);
      state.authorizedDepartments = Array.isArray(departments) ? departments : [];
    } catch (_e) {
      state.authorizedDepartments = [];
    }

    // Role change MUST clear department context and require user to explicitly select an authorized department
    switchView('landing');
    await loadGlobalLanding();
  });
}


// =============================================================================
// GLOBAL / DEPARTMENT CONTEXT
// =============================================================================
function updateHeaderDepartmentContext() {
  const crumbContainer = document.getElementById('header-breadcrumb');
  const crumbDeptName = document.getElementById('crumb-dept-name');
  const switchBtn = document.getElementById('btn-switch-dept-header');

  if (state.activeDepartment) {
    if (crumbContainer) crumbContainer.style.display = 'flex';
    if (crumbDeptName) crumbDeptName.textContent = state.activeDepartment.displayName || state.activeDepartment.name;
    if (switchBtn) switchBtn.style.display = '';
  } else {
    if (crumbContainer) crumbContainer.style.display = 'none';
    if (crumbDeptName) crumbDeptName.textContent = 'Select Department';
    if (switchBtn) switchBtn.style.display = 'none';
  }
}

window.selectGlobalLanding = async function() {
  const doSwitch = () => {
    state.activeDepartment = null;
    resetWizardUiState();
    state.importsList = [];
    window.localStorage.removeItem('dataImport.activeDepartmentId');
    updateHeaderDepartmentContext();
    switchView('landing');
  };

  if (state.currentImportId && state.activeView === 'wizard' && state.currentStep < 10 && isCurrentStepDirty()) {
    openDraftModal(
      () => doSwitch(),
      async () => {
        const saved = await saveCurrentImportAsDraft();
        if (!saved) return false;
        doSwitch();
        return true;
      }
    );
    return;
  }
  doSwitch();
};

async function loadGlobalLanding() {
  const grid = document.getElementById('department-cards-grid');
  const requestedRole = state.userContext.role;
  const requestedOrg = state.userContext.organizationId;
  try {
    const role = encodeURIComponent(requestedRole || 'org_admin');
    const departments = await apiRequest(`/departments?role=${role}`);
    if (state.userContext.role !== requestedRole || state.userContext.organizationId !== requestedOrg) return;
    state.authorizedDepartments = Array.isArray(departments) ? departments : [];

    const badge = document.getElementById('authorized-dept-count-badge');
    if (badge) badge.textContent = `${state.authorizedDepartments.length} Departments Authorized`;

    if (grid) {
      if (!state.authorizedDepartments.length) {
        grid.innerHTML = '<div class="empty-state"><p>No department modules are authorized for this role.</p></div>';
      } else {
        grid.innerHTML = state.authorizedDepartments.map(dept => `
          <button class="department-card" type="button" onclick="selectDepartment('${escapeHtml(dept.id)}')">
            <div class="department-card-icon">${escapeHtml(dept.icon || '▦')}</div>
            <div class="department-card-content">
              <div class="department-card-title">${escapeHtml(dept.displayName || dept.name)}</div>
              <div class="department-card-description">${escapeHtml(dept.description || '')}</div>
              <div class="department-card-meta">
                <span>${Number(dept.entityCount || 0)} entities</span>
                <span>${Number(dept.templateCount || 0)} templates</span>
                <span>${Number(dept.recentImportCount || 0)} recent imports</span>
              </div>
            </div>
            <span class="department-card-action">Open Data Centre →</span>
          </button>
        `).join('');
      }
    }

    const global = await apiRequest('/departments/global/dashboard');
    if (state.userContext.role !== requestedRole || state.userContext.organizationId !== requestedOrg) return;
    const metrics = global?.metrics || {};
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = Number(value || 0).toLocaleString(); };
    set('global-kpi-total-imports', metrics.totalJobs);
    set('global-kpi-completed-imports', metrics.completedJobs);
    set('global-kpi-pending-approval', metrics.pendingApproval);
    set('global-kpi-total-records', metrics.totalRecords);
  } catch (err) {
    if (state.userContext.role !== requestedRole || state.userContext.organizationId !== requestedOrg) return;
    if (grid) grid.innerHTML = `<div class="empty-state"><p>Could not load authorized departments.</p><small>${escapeHtml(err.message)}</small></div>`;
  }
}

function resetDashboardUiLoadingState(dept) {
  const deptName = dept ? (dept.name || dept.displayName) : '';
  const titleEl = document.getElementById('dashboard-dept-title');
  const recentJobsTitleEl = document.getElementById('recent-jobs-table-title');
  const totalEl = document.getElementById('kpi-total-imports');
  const completedEl = document.getElementById('kpi-completed-imports');
  const pendingEl = document.getElementById('kpi-pending-approval');
  const recordsEl = document.getElementById('kpi-total-records');
  const badgeEl = document.getElementById('imports-count-badge');
  const tbody = document.getElementById('dashboard-table-body');

  if (titleEl) titleEl.textContent = deptName ? `${String(deptName).toUpperCase()} DATA IMPORT DASHBOARD` : 'DATA IMPORT DASHBOARD';
  if (recentJobsTitleEl) recentJobsTitleEl.textContent = deptName ? `Recent ${deptName} Import Jobs` : 'Recent Import Jobs';
  if (totalEl) totalEl.textContent = '...';
  if (completedEl) completedEl.textContent = '...';
  if (pendingEl) pendingEl.textContent = '...';
  if (recordsEl) recordsEl.textContent = '...';
  if (badgeEl) badgeEl.textContent = 'Loading...';
  if (tbody) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8" class="text-center text-muted" style="padding:24px;">
          Loading ${escapeHtml(deptName || 'department')} dashboard...
        </td>
      </tr>
    `;
  }
}

function resetWizardUiState() {
  state.currentStep = 1;
  state.currentImportId = null;
  state.currentImport = null;
  state.selectedFile = null;
  state.parsedDataset = null;
  state.columnMappings = [];
  state.validationResult = null;
  renderValidationResultMessage({}, '');
  state.stagedRecords = [];
  state.duplicateResult = null;
  state.resolvedDuplicateRecords = [];
  state.reviewSummary = null;
  state.executionResult = null;
  state.reconciliationResult = null;

  window.localStorage.removeItem('dataImport.currentImportId');
  window.localStorage.removeItem('dataImport.currentStep');

  const jobNameInput = document.getElementById('input-job-name');
  const jobDescInput = document.getElementById('input-job-description');
  const entitySelect = document.getElementById('select-target-entity');
  const activeJobBar = document.getElementById('active-job-bar');

  if (jobNameInput) jobNameInput.value = 'Import Job ' + new Date().toLocaleDateString();
  if (jobDescInput) jobDescInput.value = '';
  if (entitySelect) entitySelect.value = '';
  if (activeJobBar) activeJobBar.style.display = 'none';

  clearStep2FileUi({ clearState: true });
  renderEntitySchemaPreview('');

  for (let i = 1; i <= 10; i++) {
    const node = document.getElementById(`step-node-${i}`);
    if (!node) continue;
    node.classList.remove('active', 'completed');
    if (i === 1) node.classList.add('active');
  }

  document.querySelectorAll('.wizard-step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('wizard-step-1')?.classList.add('active');
}

window.selectDepartment = async function(departmentId) {
  const selected = state.authorizedDepartments.find(d => d.id === departmentId);
  if (!selected) {
    showToast('That department is not authorized for the current role.', 'error');
    return;
  }

  // Set active department and store in localStorage for page refreshes
  state.activeDepartment = selected;
  window.localStorage.setItem('dataImport.activeDepartmentId', selected.id);

  // Clear previous department data and import job state immediately
  resetWizardUiState();
  state.importsList = [];
  state.entities = [];

  // Immediately reset UI KPI and table elements so previous department data disappears
  resetDashboardUiLoadingState(selected);

  updateHeaderDepartmentContext();
  switchView('dashboard');
  await Promise.all([loadDashboard(), loadEntitySchemas()]);
};

// =============================================================================
// DASHBOARD LOGIC
// =============================================================================
async function loadDashboard() {
  if (!state.activeDepartment) {
    await loadGlobalLanding();
    return;
  }

  // Verify that active department is authorized for the active user role
  const isAuthorized = state.authorizedDepartments.some(d => d.id === state.activeDepartment.id);
  if (!isAuthorized) {
    state.activeDepartment = null;
    state.importsList = [];
    updateHeaderDepartmentContext();
    switchView('landing');
    await loadGlobalLanding();
    return;
  }

  const activeDeptId = state.activeDepartment.id;
  const currentRole = state.userContext.role;
  const currentOrg = state.userContext.organizationId;

  // Clear previous department jobs list and reset UI loading indicators
  state.importsList = [];
  resetDashboardUiLoadingState(state.activeDepartment);

  try {
    const result = await apiRequest(`/departments/${encodeURIComponent(activeDeptId)}/dashboard`);

    // Race condition guard: discard response if context changed while API call was in flight
    if (
      !state.activeDepartment ||
      state.activeDepartment.id !== activeDeptId ||
      state.userContext.role !== currentRole ||
      state.userContext.organizationId !== currentOrg
    ) {
      return;
    }

    const metrics = result?.metrics || {};
    state.importsList = Array.isArray(result?.recentJobs) ? result.recentJobs : [];

    const deptName = state.activeDepartment.name || state.activeDepartment.displayName;
    document.getElementById('dashboard-dept-title').textContent = `${String(deptName).toUpperCase()} DATA IMPORT DASHBOARD`;
    document.getElementById('recent-jobs-table-title').textContent = `Recent ${deptName} Import Jobs`;
    document.getElementById('kpi-total-imports').textContent = Number(metrics.totalJobs || 0).toLocaleString();
    document.getElementById('kpi-completed-imports').textContent = Number(metrics.completedJobs || 0).toLocaleString();
    document.getElementById('kpi-pending-approval').textContent = Number(metrics.pendingApproval || 0).toLocaleString();
    document.getElementById('kpi-total-records').textContent = Number(metrics.totalRecords || 0).toLocaleString();
    document.getElementById('imports-count-badge').textContent = `${state.importsList.length} recent jobs`;

    renderDashboardTable(state.importsList);
  } catch (err) {
    if (state.activeDepartment && state.activeDepartment.id === activeDeptId) {
      showToast('Failed to load department dashboard: ' + err.message, 'error');
      const tbody = document.getElementById('dashboard-table-body');
      if (tbody) {
        tbody.innerHTML = `
          <tr class="empty-row">
            <td colspan="8" class="text-center text-muted" style="padding:24px;">
              Failed to load dashboard data. <button class="btn btn-secondary btn-xs" onclick="loadDashboard()">Retry</button>
            </td>
          </tr>
        `;
      }
    }
  }
}

function renderDashboardTable(imports) {
  const tbody = document.getElementById('dashboard-table-body');
  if (!tbody) return;

  const deptName = state.activeDepartment ? (state.activeDepartment.name || state.activeDepartment.displayName) : 'department';

  if (!imports || imports.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            <p>No import jobs created yet for ${escapeHtml(deptName)}.</p>
            <button class="btn btn-primary btn-sm" onclick="startNewImportWorkflow()">Create Your First Import</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = imports.map(item => `
    <tr>
      <td>
        <strong>${escapeHtml(item.name || 'Untitled')}</strong>
        <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${item.id}</div>
      </td>
      <td><span class="badge badge-neutral">${item.targetEntity || '-'}</span></td>
      <td><span class="badge badge-info">${item.source?.detectedFormat || item.source?.type || 'CSV'}</span></td>
      <td><span class="badge badge-${getStatusBadgeClass(item.status)}">${item.status}</span></td>
      <td>${(item.totalRecords || 0).toLocaleString()}</td>
      <td>${item.createdBy || 'Admin'}</td>
      <td>${formatDate(item.createdAt)}</td>
      <td class="text-right">
        <button class="btn btn-secondary btn-xs" onclick="resumeImport('${item.id}', '${item.status}')">Open Studio</button>
      </td>
    </tr>
  `).join('');
}

function setupDashboardEvents() {
  document.getElementById('btn-refresh-dashboard')?.addEventListener('click', loadDashboard);
  
  const searchInput = document.getElementById('dashboard-search-input');
  searchInput?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderDashboardTable(state.importsList);
      return;
    }
    const filtered = state.importsList.filter(i => 
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.targetEntity && i.targetEntity.toLowerCase().includes(q)) ||
      (i.status && i.status.toLowerCase().includes(q)) ||
      (i.id && i.id.toLowerCase().includes(q))
    );
    renderDashboardTable(filtered);
  });
}

// Resume or Open Existing Import
window.resumeImport = async function(importId, status) {
  try {
    // Clear the previous import's Step 2 file before hydrating this import. The
    // selected file must only be visible when this import actually has one.
    clearStep2FileUi({ clearState: true });
    const importData = await apiRequest(`/${importId}`);
    state.currentImportId = importId;
    state.currentImport = importData;

    // Restore file display for step 2 so Back navigation works correctly
    showExistingFileOnStep2(importData);

    switchView('wizard');
    await hydrateWizardForStatus(importData);

    showToast(`Loaded import job: ${importData.name}`, 'info');
  } catch (err) {
    showToast('Failed to resume import: ' + err.message, 'error');
  }
};

// =============================================================================
// WIZARD STEP LOGIC
// =============================================================================
window.startNewImportWorkflow = function() {
  // Starting a brand-new import must always start with an empty Step 2 upload
  // surface. Do not visually carry over a file from the previous import.
  clearStep2FileUi({ clearState: true });
  if (!state.activeDepartment) {
    showToast('Select an authorized department before creating an import.', 'error');
    selectGlobalLanding();
    return;
  }
  state.currentImportId = null;
  state.currentImport = null;
  state.selectedFile = null;
  state.parsedDataset = null;
  state.columnMappings = [];
  state.validationResult = null;
  renderValidationResultMessage({}, '');
  state.stagedRecords = [];
  window.localStorage.removeItem('dataImport.currentImportId');
  window.localStorage.removeItem('dataImport.currentStep');
  
  document.getElementById('input-job-name').value = 'Import Job ' + new Date().toLocaleDateString();
  document.getElementById('input-job-description').value = '';
  const select = document.getElementById('select-target-entity');
  if (select) {
    select.value = '';
  }
  
  switchView('wizard');
  goToWizardStep(1);
  renderEntitySchemaPreview('');
};

async function loadEntitySchemas() {
  try {
    const endpoint = state.activeDepartment
      ? `/departments/${encodeURIComponent(state.activeDepartment.id)}/entities`
      : '/entities';
    const entities = await apiRequest(endpoint);
    state.entities = Array.isArray(entities) ? entities : [];
    
    const select = document.getElementById('select-target-entity');
    if (select) {
      const currentValue = select.value;
      select.innerHTML = '<option value="">Select Destination Entity...</option>' + 
        state.entities.map(e => `<option value="${e.entity}">${e.displayName} (${e.entity})</option>`).join('');
      if (currentValue && state.entities.some(e => e.entity === currentValue)) {
        select.value = currentValue;
        renderEntitySchemaPreview(currentValue);
      } else {
        select.value = '';
        renderEntitySchemaPreview('');
      }
    }
  } catch (err) {
    console.warn('Failed to load entity schemas:', err);
  }
}

function renderEntitySchemaPreview(entityName) {
  const previewBox = document.getElementById('entity-schema-preview-box');
  const tagsList = document.getElementById('schema-fields-tags-list');
  const statsPills = document.getElementById('schema-stats-pills');
  const csvBtn = document.getElementById('btn-download-csv-template');
  const xlsxBtn = document.getElementById('btn-download-xlsx-template');

  if (!previewBox || !tagsList) return;

  const entity = state.entities.find(e => e.entity === entityName);
  if (!entity) {
    previewBox.style.display = 'none';
    return;
  }

  const importableFields = Object.values(entity.fields || {}).filter(f => !f.readOnly);
  const requiredCount = importableFields.filter(f => f.required).length;
  const optionalCount = importableFields.length - requiredCount;

  if (statsPills) {
    statsPills.innerHTML = `
      <span class="badge badge-neutral" style="font-size:0.75rem;">Total Fields: ${importableFields.length}</span>
      <span class="badge badge-info" style="font-size:0.75rem;">Required: ${requiredCount}</span>
      <span class="badge badge-neutral" style="font-size:0.75rem;">Optional: ${optionalCount}</span>
    `;
  }

  if (csvBtn) {
    csvBtn.href = `/api/v1/data-imports/entities/${entityName}/template/download?format=csv`;
  }
  if (xlsxBtn) {
    xlsxBtn.href = `/api/v1/data-imports/entities/${entityName}/template/download?format=xlsx`;
  }

  previewBox.style.display = 'block';
  tagsList.innerHTML = importableFields.map(f => `
    <span class="badge ${f.required ? 'badge-info' : 'badge-neutral'}" style="margin: 3px; font-size:0.75rem;">
      ${f.label} (${f.name}) ${f.required ? '*' : ''}
    </span>
  `).join('');
}

function setupWizardEvents() {
  // Step 1 Dirty Tracking
  ['input-job-name', 'select-target-entity', 'input-job-description'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', markCurrentStepDirty);
    el.addEventListener('change', markCurrentStepDirty);
  });

  // Step 2 Dirty Tracking
  ['input-batch-size', 'input-max-records', 'select-max-file-size', 'input-header-row', 'input-timezone', 'select-error-strategy', 'select-import-duplicate-strategy'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', markCurrentStepDirty);
    el.addEventListener('input', markCurrentStepDirty);
  });

  // Live update dropzone hint when max file size changes
  document.getElementById('select-max-file-size')?.addEventListener('change', (e) => {
    const mb = Number(e.target.value);
    const label = document.getElementById('dropzone-maxsize-label');
    if (label) label.textContent = mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
  });

  // Target Entity Select Change
  document.getElementById('select-target-entity')?.addEventListener('change', (e) => {
    renderEntitySchemaPreview(e.target.value);
  });

  // Step 1 -> Next (Create Draft)
  document.getElementById('btn-step1-next')?.addEventListener('click', async () => {
    const name = document.getElementById('input-job-name').value.trim();
    const targetEntity = document.getElementById('select-target-entity').value;
    const description = document.getElementById('input-job-description').value.trim();

    if (!name) {
      showToast('Please enter an import job name', 'error');
      return;
    }
    if (!targetEntity) {
      showToast('Please select a target entity', 'error');
      return;
    }

    try {
      const draft = await apiRequest('/', {
        method: 'POST',
        body: JSON.stringify({
          name,
          targetEntity,
          targetModule: state.activeDepartment?.id || undefined,
          description
        })
      });

      state.currentImportId = draft.id;
      state.currentImport = draft;
      // The create endpoint returns a clean DRAFT with no source file. Explicitly
      // reset Step 2 here as well, so an earlier import cannot remain visible in
      // the DOM while this new draft is being edited.
      clearStep2FileUi({ clearState: true });
      window.localStorage.setItem('dataImport.currentImportId', draft.id);
      showToast('Import job created: ' + draft.name, 'success');
      goToWizardStep(2);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Step 2: File Ingestion & Drag/Drop
  setupFileUploadEvents();

  // Step 3: Column Mapping Events
  setupMappingEvents();

  // Step 4: Validation Events
  setupValidationEvents();

  // Step 5: Matching Events
  setupMatchingEvents();

  // Step 6: Review Events
  setupReviewEvents();

  // Step 7: Approval Events
  setupApprovalEvents();

  // Step 8: Execution Events
  setupExecutionEvents();

  // Step 9: Reconciliation Events
  setupReconciliationEvents();

  // Step 10: Report & Export Events
  setupReportExportEvents();

}

// -----------------------------------------------------------------------------
// STEP 2: FILE UPLOAD & INGESTION
// -----------------------------------------------------------------------------
/**
 * Clears all Step 2 file-related UI so a new/empty import never inherits the
 * previously displayed file from an earlier import session.
 */
function clearStep2FileUi({ clearState = false } = {}) {
  if (clearState) {
    state.selectedFile = null;
    state.parsedDataset = null;
    state.currentProfiles = [];
  }

  const card = document.getElementById('selected-file-card');
  const parsedCard = document.getElementById('parsed-file-details-card');
  const continueBtn = document.getElementById('btn-step2-continue-mapping');
  const uploadBtn = document.getElementById('btn-step2-upload');
  const fileInput = document.getElementById('file-input');
  const progressContainer = document.getElementById('upload-progress-container');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressText = document.getElementById('upload-progress-percent');
  const progressStatus = document.getElementById('upload-progress-status');
  const nameEl = document.getElementById('selected-file-name');
  const metaEl = document.getElementById('selected-file-meta');
  const badgeEl = document.getElementById('file-format-badge');
  const columnsGrid = document.getElementById('parsed-column-cards-grid');

  if (card) card.style.display = 'none';
  if (parsedCard) parsedCard.style.display = 'none';
  if (continueBtn) {
    continueBtn.disabled = true;
    continueBtn.style.display = 'none';
  }
  if (uploadBtn) {
    uploadBtn.disabled = !hasPermission('DATA_IMPORT_UPLOAD');
    uploadBtn.textContent = 'Upload & Parse File';
    uploadBtn.title = '';
  }
  if (fileInput) fileInput.value = '';
  if (progressContainer) progressContainer.style.display = 'none';
  if (progressFill) progressFill.style.width = '0%';
  if (progressText) progressText.textContent = '0%';
  if (progressStatus) progressStatus.textContent = 'Uploading and verifying security signatures...';
  if (nameEl) nameEl.textContent = '-';
  if (metaEl) metaEl.textContent = '-';
  if (badgeEl) badgeEl.textContent = 'FILE';
  if (columnsGrid) columnsGrid.innerHTML = '';

  if (clearState) {
    const parsedRowCount = document.getElementById('parsed-row-count');
    const parsedColumnCount = document.getElementById('parsed-column-count');
    const parsedFormat = document.getElementById('parsed-format');
    const parsedFileSize = document.getElementById('parsed-file-size');
    const parsedSummary = document.getElementById('parsed-file-summary');
    if (parsedRowCount) parsedRowCount.textContent = '0';
    if (parsedColumnCount) parsedColumnCount.textContent = '0';
    if (parsedFormat) parsedFormat.textContent = '-';
    if (parsedFileSize) parsedFileSize.textContent = '-';
    if (parsedSummary) parsedSummary.textContent = '-';
  }
}

/**
 * Shows existing file metadata on step 2 for an import that already has a file,
 * without re-uploading. This is used by Back navigation and resume flows so the
 * user can see the file they uploaded and proceed to re-parse if needed.
 */
function showExistingFileOnStep2(importJob) {
  // A persisted file is represented by fileName, which is only populated by the
  // server upload flow. Never leave an old file card on screen for an import that
  // has not uploaded a source file.
  if (!importJob || !importJob.fileName) {
    clearStep2FileUi();
    return;
  }
  const card = document.getElementById('selected-file-card');
  const nameEl = document.getElementById('selected-file-name');
  const metaEl = document.getElementById('selected-file-meta');
  const badgeEl = document.getElementById('file-format-badge');
  const uploadBtn = document.getElementById('btn-step2-upload');

  if (!card || !nameEl) return;

  // We have a server-side file. Show its metadata.
  nameEl.textContent = importJob.fileName;
  const sizeStr = importJob.fileSizeBytes ? formatBytes(importJob.fileSizeBytes) : 'Unknown size';
  const mimeStr = importJob.fileMimeType || '';
  metaEl.textContent = `${sizeStr} | ${mimeStr} | Already uploaded`;

  const ext = importJob.fileName.split('.').pop().toUpperCase();
  if (badgeEl) badgeEl.textContent = ext;

  card.style.display = 'flex';

  // Since we have an existing file, enable re-upload/re-parse button but label it clearly.
  // The user can drop a new file if they want to replace it.
  if (uploadBtn) {
    uploadBtn.disabled = false;
    uploadBtn.title = 'Click to replace the existing file with a new one, or use the current file to proceed to mapping.';
  }

  // Also render parsed dataset details (headers, row count, sample rows) if available
  if (importJob.fileMetadata) {
    renderParsedFileDetails({
      headers: importJob.fileMetadata.headers,
      sampleRows: importJob.fileMetadata.sampleRows,
      rowCount: importJob.fileMetadata.rowCount || importJob.totalRecords,
      columnCount: importJob.fileMetadata.columnCount || (importJob.fileMetadata.headers || []).length,
      format: importJob.fileMetadata.format,
      profiles: importJob.fileMetadata.profiles || []
    }, {
      detectedFormat: importJob.fileMetadata.format
    });

    const continueBtn = document.getElementById('btn-step2-continue-mapping');
    if (continueBtn && importJob.fileMetadata.headers?.length) {
      continueBtn.disabled = false;
      continueBtn.style.display = '';
    }
  }
}

function setupFileUploadEvents() {
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('btn-step2-upload');
  const backBtn = document.getElementById('btn-step2-back');

  backBtn?.addEventListener('click', async () => {
    if (backBtn.dataset.draftAware === 'true') return;
    // Going back to step 1 (Create Import). The file and draft are preserved on the server.
    // Just navigate; do NOT cancel or reset the import.
    goToWizardStep(1);
  });

  dropzone?.addEventListener('click', () => fileInput?.click());
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  document.getElementById('btn-remove-file')?.addEventListener('click', () => {
    clearStep2FileUi({ clearState: true });
  });

  document.getElementById('select-import-duplicate-strategy')?.addEventListener('change', async (e) => {
    if (!state.currentImportId) return;
    const duplicateStrategy = e.target.value;
    if (state.currentImport) {
      if (!state.currentImport.importOptions) state.currentImport.importOptions = {};
      state.currentImport.importOptions.duplicateStrategy = duplicateStrategy;
    }
    const matchSelect = document.getElementById('select-match-action');
    if (matchSelect) matchSelect.value = duplicateStrategy;
    try {
      await apiRequest(`/${state.currentImportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ importOptions: { ...(state.currentImport?.importOptions || {}), duplicateStrategy } })
      });
    } catch (_) {}
  });

  document.getElementById('btn-save-import-options')?.addEventListener('click', async () => {
    if (!state.currentImportId) return;
    try {
      const batchSize = Number(document.getElementById('input-batch-size')?.value || 500);
      const maxRecords = Number(document.getElementById('input-max-records')?.value || 0);
      const maxFileSizeMB = Number(document.getElementById('select-max-file-size')?.value || 100);
      const skipHeaderRows = Number(document.getElementById('input-header-row')?.value || 0);
      const timezone = document.getElementById('input-timezone')?.value.trim() || 'UTC';
      const errorStrategy = document.getElementById('select-error-strategy')?.value || 'CONTINUE_ON_ERROR';
      const duplicateStrategy = document.getElementById('select-import-duplicate-strategy')?.value || 'SKIP';
      await apiRequest(`/${state.currentImportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ importOptions: { batchSize, skipHeaderRows, timezone, errorStrategy, duplicateStrategy, maxRecords, maxFileSizeMB } })
      });
      // Update the dropzone hint label
      const label = document.getElementById('dropzone-maxsize-label');
      if (label) label.textContent = maxFileSizeMB >= 1024 ? `${maxFileSizeMB / 1024} GB` : `${maxFileSizeMB} MB`;
      showToast('Import options saved.', 'success');
    } catch (err) {
      showToast('Failed to save import options: ' + err.message, 'error');
    }
  });

  // Quick Demo File Loaders
  document.querySelectorAll('.demo-file-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fileName = btn.dataset.file;
      await loadDemoFile(fileName);
    });
  });

  // Upload and Parse trigger
  uploadBtn?.addEventListener('click', async () => {
    await uploadAndParseCurrentFile();
  });

  // Parsing is intentionally a distinct stage. The user must see the detected
  // columns and inspect them before entering the mapping screen.
  document.getElementById('btn-step2-continue-mapping')?.addEventListener('click', async () => {
    if (!state.currentImportId) return;
    try {
      const refreshed = await apiRequest(`/${state.currentImportId}`);
      state.currentImport = refreshed;
      if (!['PARSED', 'MAPPING', 'MAPPED', 'VALIDATION_FAILED', 'VALIDATED'].includes(refreshed.status)) {
        showToast(`The file is not ready for mapping yet (current state: ${refreshed.status}).`, 'error');
        return;
      }
      await loadMappingSuggestions();
      goToWizardStep(3);
    } catch (err) {
      showToast('Could not open mapping: ' + err.message, 'error');
    }
  });
}

async function uploadAndParseCurrentFile() {
  if (!state.selectedFile) return;

  if (!state.currentImportId) {
    const targetEntity = document.getElementById('select-target-entity')?.value || 'contacts';
    const name = `Import ${targetEntity.toUpperCase()} ${new Date().toISOString().slice(0, 10)}`;
    try {
      const draft = await apiRequest('/', {
        method: 'POST',
        body: JSON.stringify({ name, targetEntity, description: 'Auto-created import draft' })
      });
      state.currentImportId = draft.id;
      state.currentImport = draft;
      window.localStorage.setItem('dataImport.currentImportId', draft.id);
    } catch (err) {
      showToast('Failed to initialize import draft: ' + err.message, 'error');
      return;
    }
  }

  const uploadBtn = document.getElementById('btn-step2-upload');
  try {
    if (uploadBtn) uploadBtn.disabled = true;
    const progressContainer = document.getElementById('upload-progress-container');
    const progressFill = document.getElementById('upload-progress-fill');
    const progressText = document.getElementById('upload-progress-percent');
    const statusEl = document.getElementById('upload-progress-status');

    if (progressContainer) progressContainer.style.display = 'block';
    if (progressFill) progressFill.style.width = '35%';
    if (progressText) progressText.textContent = 'Uploading...';
    if (statusEl) statusEl.textContent = 'Uploading and verifying source file...';

    const formData = new FormData();
    formData.append('file', state.selectedFile);

    const uploadRes = await apiRequest(`/${state.currentImportId}/upload`, {
      method: 'POST',
      body: formData
    });

    if (progressFill) progressFill.style.width = '70%';
    if (progressText) progressText.textContent = 'Parsing...';
    if (statusEl) statusEl.textContent = 'Parsing dataset & extracting columns...';

    // Now Parse Dataset
    const parseRes = await apiRequest(`/${state.currentImportId}/parse`, {
      method: 'POST'
    });

    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = 'Complete';
    if (statusEl) statusEl.textContent = 'File parsed! Displaying columns...';

    state.parsedDataset = parseRes;

    const refreshedImport = await apiRequest(`/${state.currentImportId}`);
    state.currentImport = refreshedImport;
    populateImportOptions(refreshedImport);
    window.localStorage.setItem('dataImport.currentImportId', refreshedImport.id);

    // Refresh the authoritative cross-step strip immediately after parsing.
    // At this point total rows and columns are known, while validation-dependent
    // metrics are intentionally left as an em dash until validation actually runs.
    // This prevents the header from showing misleading 0/0 values beside a
    // successfully parsed dataset (for example, 18 rows x 4 columns).
    const parsedTotalRows = Number(parseRes?.rowCount ?? parseRes?.totalRows ?? refreshedImport?.fileMetadata?.rowCount ?? 0);
    const parsedColumnCount = Number(parseRes?.columnCount ?? parseRes?.headers?.length ?? refreshedImport?.fileMetadata?.columnCount ?? 0);
    renderWorkflowStats({
      rows: { total: parsedTotalRows, valid: null, warnings: null, invalid: null, corrected: null, duplicates: null, inserted: null, updated: null, failed: null, skipped: null },
      columns: parsedColumnCount
    });

    // Re-read the backend snapshot as well so all screens use the same source
    // of truth after the parse transaction has been persisted.
    await refreshWorkflowStats();

    // The parsed file inspection stage is deliberately visible. Render the
    // server-generated profiles (type, nulls, unique/duplicate counts, samples,
    // and target-field suggestions) before allowing the user into mapping.
    renderParsedFileDetails({
      ...parseRes,
      profiles: refreshedImport.fileMetadata?.profiles || parseRes.profiles || []
    }, uploadRes);

    const continueBtn = document.getElementById('btn-step2-continue-mapping');
    if (continueBtn) {
      continueBtn.disabled = false;
      continueBtn.style.display = '';
    }
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Re-parse File';
    }

    // Do NOT auto-enter mapping. The backend state remains PARSED until the
    // user explicitly continues after reviewing the detected columns.
    goToWizardStep(2);
    showToast(`File uploaded & parsed! ${parseRes.rowCount || 0} rows detected across ${parseRes.columnCount || 0} columns. Review the detected columns, then continue to mapping.`, 'success');
  } catch (err) {
    showToast('Upload/Parse failed: ' + err.message, 'error');
    if (uploadBtn) uploadBtn.disabled = false;
  }
}

function renderParsedFileDetails(parsed, uploadResult = {}) {
  const card = document.getElementById('parsed-file-details-card');
  if (!card) return;

  const headers = parsed?.headers || parsed?.columns || [];
  const rows = parsed?.sampleRows || parsed?.rows || [];
  const rowCount = parsed?.rowCount ?? parsed?.totalRows ?? rows.length;
  const columnCount = parsed?.columnCount ?? headers.length;
  const format = parsed?.format || uploadResult?.detectedFormat || state.selectedFile?.name?.split('.').pop()?.toUpperCase() || '-';
  const fileSize = state.selectedFile ? formatBytes(state.selectedFile.size) : (uploadResult?.sizeBytes ? formatBytes(uploadResult.sizeBytes) : '-');

  document.getElementById('parsed-row-count').textContent = String(rowCount);
  document.getElementById('parsed-column-count').textContent = String(columnCount);
  document.getElementById('parsed-format').textContent = String(format).toUpperCase();
  const sizeEl = document.getElementById('parsed-file-size');
  if (sizeEl) sizeEl.textContent = fileSize;
  
  document.getElementById('parsed-file-summary').textContent = state.selectedFile
    ? `${state.selectedFile.name} • ${fileSize} • Parsed & Profiled Successfully`
    : 'Parsed source dataset';

  const profiles = parsed?.profiles || state.currentImport?.fileMetadata?.profiles || [];
  state.currentProfiles = profiles;

  const gridContainer = document.getElementById('parsed-column-cards-grid');
  if (gridContainer) {
    if (profiles.length > 0) {
      gridContainer.innerHTML = profiles.map((p) => `
        <div class="column-name-only" title="${escapeHtml(p.originalName)}">
          <span class="column-name-only-text">${escapeHtml(p.originalName)}</span>
        </div>
      `).join('');
    } else {
      gridContainer.innerHTML = headers.map((h) => {
        const name = typeof h === 'string' ? h : (h.originalName || h.name || h.header || '');
        return `
          <div class="column-name-only" title="${escapeHtml(name)}">
            <span class="column-name-only-text">${escapeHtml(name)}</span>
          </div>
        `;
      }).join('');
    }
  }

  card.style.display = 'block';
}

function inspectColumn(profileIndex) {
  const profile = state.currentProfiles ? state.currentProfiles[profileIndex] : null;
  const drawer = document.getElementById('column-inspect-drawer');
  const backdrop = document.getElementById('column-inspect-drawer-backdrop');
  if (!drawer || !backdrop) return;

  const targetEntityName = document.getElementById('select-target-entity')?.value || state.currentImport?.targetEntity || '';
  const schema = state.entities.find(e => e.entity === targetEntityName);

  let mappedTargetField = 'Unmapped';
  let isRequired = false;
  if (schema && profile) {
    const matchedField = Object.values(schema.fields || {}).find(f => 
      f.name.toLowerCase() === profile.normalizedName.toLowerCase() ||
      (f.aliases && f.aliases.some(a => a.toLowerCase() === profile.normalizedName.toLowerCase()))
    );
    if (matchedField) {
      mappedTargetField = `${matchedField.label} (${matchedField.name})`;
      isRequired = matchedField.required;
    }
  }

  const name = profile ? profile.originalName : `Column #${profileIndex + 1}`;
  document.getElementById('drawer-column-title').textContent = name;
  document.getElementById('drawer-original-name').textContent = profile ? `Normalized Header: ${profile.normalizedName}` : '';

  const sampleList = profile?.sampleValues || [];
  const sampleBadgesHtml = sampleList.length > 0
    ? sampleList.map(v => `<span class="badge badge-neutral" style="margin: 2px;">${escapeHtml(String(v))}</span>`).join('')
    : '<span class="text-muted">No non-null sample values</span>';

  const potentialFields = profile?.potentialTargetFields || [];
  const potentialHtml = potentialFields.length > 0
    ? potentialFields.map(pf => `<div style="display:flex; justify-space-between; align-items:center; font-size:0.8rem; margin-bottom:4px;">
        <span><strong>${escapeHtml(pf.label)}</strong> (${escapeHtml(pf.fieldName)})</span>
        <span class="badge badge-success" style="font-size:0.7rem;">Score: ${pf.score}</span>
      </div>`).join('')
    : '<span class="text-muted" style="font-size:0.8rem;">No high-confidence suggestions</span>';

  document.getElementById('drawer-column-content').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="background:var(--bg-card); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:0.8rem; color:var(--text-muted);">Detected Data Type</span>
          <span class="badge badge-info">${profile?.detectedType || 'STRING'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:0.8rem; color:var(--text-muted);">Format Consistency</span>
          <span class="badge badge-success">${profile?.formatConsistency ?? 100}%</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.8rem; color:var(--text-muted);">Mapped Target Field</span>
          <span class="badge ${mappedTargetField !== 'Unmapped' ? 'badge-success' : 'badge-neutral'}">
            ${escapeHtml(mappedTargetField)} ${isRequired ? '*' : ''}
          </span>
        </div>
      </div>

      <div style="background:var(--bg-card); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
        <h4 style="margin:0 0 10px 0; font-size:0.85rem; color:var(--text-main);">Column Aggregated Profile Metrics</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.8rem;">
          <div>Total Records: <strong>${profile?.totalRows ?? '-'}</strong></div>
          <div>Non-Empty: <strong>${profile?.nonEmptyCount ?? '-'}</strong></div>
          <div>Valid Records: <strong class="text-green">${profile?.validCount ?? '-'}</strong></div>
          <div>Invalid Records: <strong class="text-red">${profile?.invalidCount ?? 0}</strong></div>
          <div>Missing Records: <strong class="text-amber">${profile?.missingCount ?? 0}</strong></div>
          <div>Missing %: <strong>${profile?.missingPercentage ?? 0}%</strong></div>
          <div>Unique Values: <strong>${profile?.uniqueCount ?? '-'}</strong></div>
          <div>Duplicate Values: <strong>${profile?.duplicateCount ?? 0}</strong></div>
        </div>
      </div>

      <div style="background:var(--bg-card); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
        <h4 style="margin:0 0 8px 0; font-size:0.85rem; color:var(--text-main);">Potential Target Field Matches</h4>
        <div style="margin-top:6px;">${potentialHtml}</div>
      </div>

      <div style="background:var(--bg-card); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
        <h4 style="margin:0 0 8px 0; font-size:0.85rem; color:var(--text-main);">Sample Cell Values</h4>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">
          ${sampleBadgesHtml}
        </div>
      </div>
    </div>
  `;

  backdrop.style.display = 'block';
  drawer.style.display = 'flex';
}

function closeColumnInspectDrawer() {
  const drawer = document.getElementById('column-inspect-drawer');
  const backdrop = document.getElementById('column-inspect-drawer-backdrop');
  if (drawer) drawer.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
}

function handleFileSelected(file) {
  // Validate against user-configured max file size
  const maxFileSizeMB = Number(document.getElementById('select-max-file-size')?.value || 100);
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
  if (file.size > maxFileSizeBytes) {
    showToast(`File is too large (${formatBytes(file.size)}). Max allowed: ${maxFileSizeMB} MB. Change the limit in Import Options below.`, 'error');
    return;
  }

  state.selectedFile = file;
  markCurrentStepDirty();
  const card = document.getElementById('selected-file-card');
  const nameEl = document.getElementById('selected-file-name');
  const metaEl = document.getElementById('selected-file-meta');
  const badgeEl = document.getElementById('file-format-badge');
  const uploadBtn = document.getElementById('btn-step2-upload');

  if (nameEl) nameEl.textContent = file.name;
  if (metaEl) metaEl.textContent = `${formatBytes(file.size)} | Last Modified: ${new Date(file.lastModified).toLocaleDateString()}`;
  
  const ext = file.name.split('.').pop().toUpperCase();
  if (badgeEl) badgeEl.textContent = ext;
  if (card) card.style.display = 'flex';
  if (uploadBtn) {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload & Parse File';
  }

  const parsedCard = document.getElementById('parsed-file-details-card');
  if (parsedCard) parsedCard.style.display = 'none';
  const continueBtn = document.getElementById('btn-step2-continue-mapping');
  if (continueBtn) {
    continueBtn.disabled = true;
    continueBtn.style.display = 'none';
  }
  state.currentProfiles = [];

  // Upload and parse automatically, but remain on Step 2 after parsing so the
  // user can inspect every detected column before mapping.
  uploadAndParseCurrentFile();
}

function populateMatchingStrategy(importJob) {
  const select = document.getElementById('select-match-action');
  if (!select) return;
  let strategy = importJob?.importOptions?.duplicateStrategy || 'SKIP';
  if (strategy === 'MANUAL_REVIEW') strategy = 'SEND_FOR_REVIEW';
  if (strategy === 'REJECT') strategy = 'SKIP';
  select.value = String(strategy);
  select.disabled = false;
}

function populateImportOptions(importJob) {
  const options = importJob?.importOptions || {};
  const fields = {
    'input-batch-size': options.batchSize ?? 500,
    'input-header-row': options.skipHeaderRows ?? 0,
    'input-timezone': options.timezone ?? 'UTC',
    'select-error-strategy': options.errorStrategy ?? 'CONTINUE_ON_ERROR',
    'select-import-duplicate-strategy': options.duplicateStrategy ?? 'SKIP'
  };
  for (const [id, value] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.value = String(value);
  }
  populateMatchingStrategy(importJob);
}

async function loadDemoFile(filename) {
  try {
    showToast(`Loading test sample file for entity...`, 'info');
    const targetEntity = state.currentImport?.targetEntity || document.getElementById('select-target-entity')?.value || 'contacts';
    let sampleCsvContent = '';

    if (targetEntity === 'products') {
      sampleCsvContent = `sku,product_name,price,category,stock_quantity\nPROD-101,Wireless Keyboard,79.99,Electronics,150\nPROD-102,Ergonomic Chair,299.50,Furniture,45\nPROD-103,USB-C Hub,39.00,Electronics,200\nPROD-104,4K Monitor,450.00,Electronics,30\nPROD-105,Desk Lamp,24.99,Lighting,100`;
    } else if (targetEntity === 'invoices') {
      sampleCsvContent = `invoice_number,customer_email,total_amount,issue_date,due_date,currency,status\nINV-2026-001,billing@acme.org,1250.00,2026-03-01,2026-03-31,USD,ISSUED\nINV-2026-002,accounting@stark.com,4500.00,2026-03-05,2026-04-05,USD,ISSUED\nINV-2026-003,finance@wayne.com,890.50,2026-03-10,2026-04-10,USD,PAID`;
    } else if (targetEntity === 'employees') {
      sampleCsvContent = `first_name,last_name,email,phone,department,job_title,status\nSarah,Connor,sarah.connor@cyberdyne.io,+1-555-0199,Engineering,Senior Architect,ACTIVE\nJohn,Doe,john.doe@acme.org,+1-555-0188,Operations,Manager,ACTIVE\nEllen,Ripley,ellen.ripley@weyland.com,+1-555-0177,Safety,Lead Inspector,ACTIVE`;
    } else if (targetEntity === 'customers') {
      sampleCsvContent = `customer_code,customer_name,email,phone,customer_category,account_owner,status\nCUS-1001,Acme Industries,contact@acme.example.com,+91-9000000001,Enterprise,Alex Rivera,ACTIVE\nCUS-1002,Bright Retail,info@bright.example.com,+91-9000000002,Retail,Maria Chen,ACTIVE\nCUS-1003,CloudBase Tech,hello@cloudbase.example.com,+91-9000000003,Enterprise,Alex Rivera,PROSPECT\nCUS-1004,Delta Logistics,ops@delta.example.com,+91-9000000004,SME,Jordan Smith,INACTIVE\nCUS-1005,Echo Partners,reach@echo.example.com,+91-9000000005,Retail,Maria Chen,ACTIVE`;
    } else {
      sampleCsvContent = `first_name,last_name,email,phone,company,status\nDiana,Prince,diana.prince@themyscira.org,+1-555-0101,Amazon Enterprises,ACTIVE\nBruce,Wayne,bruce.wayne@waynecorp.com,+1-555-0102,Wayne Enterprises,ACTIVE\nClark,Kent,clark.kent@dailyplanet.com,+1-555-0103,Daily Planet,LEAD\nBarry,Allen,barry.allen@centralcitypd.gov,+1-555-0104,Central City Police,LEAD\nArthur,Curry,arthur.curry@atlantis.gov,+1-555-0105,Atlantis Oceanic,ACTIVE`;
    }

    const sampleFileName = `${targetEntity}-sample.csv`;
    const blob = new Blob([sampleCsvContent], { type: 'text/csv' });
    const file = new File([blob], sampleFileName, { type: 'text/csv' });
    handleFileSelected(file);
    showToast(`Loaded sample dataset for entity '${targetEntity}'`, 'success');
  } catch (err) {
    showToast('Failed to load sample file: ' + err.message, 'error');
  }
}

// -----------------------------------------------------------------------------
// STEP 3: COLUMN MAPPING & TRANSFORMATIONS
// -----------------------------------------------------------------------------
async function loadMappingSuggestions() {
  if (!state.currentImportId) return;
  try {
    if (!state.entities || state.entities.length === 0) {
      await loadEntitySchemas();
    }
    // Always refresh the import record first so we have the correct targetEntity
    // before rendering the mapping table. This prevents stale entity schema issues
    // when navigating back/forward through the wizard.
    const refreshed = await apiRequest(`/${state.currentImportId}`);
    state.currentImport = refreshed;
    window.localStorage.setItem('dataImport.currentImportId', refreshed.id);

    const [suggestions, saved] = await Promise.all([
      apiRequest(`/${state.currentImportId}/mapping/suggestions`),
      apiRequest(`/${state.currentImportId}/mapping`).catch(() => ({ mapping: null }))
    ]);
    state.currentMapping = saved?.mapping || null;
    renderMappingTable({ ...suggestions, savedMapping: saved?.mapping || null });
  } catch (err) {
    console.warn('Failed to fetch mapping suggestions:', err);
  }
}

function renderMappingTable(mappingConfig) {
  const tbody = document.getElementById('mapping-table-body');
  if (!tbody) return;

  const sourceColumns = mappingConfig.sourceColumns || [];
  const suggestions = mappingConfig.suggestions || [];
  const savedMappings = mappingConfig.savedMapping?.columnMappings || mappingConfig.mapping?.columnMappings || {};
  const savedTransforms = mappingConfig.savedMapping?.transformations || mappingConfig.mapping?.transformations || {};

  // Get target entity fields from the loaded entities in state
  const entityName = state.currentImport?.targetEntity;
  const entity = state.entities.find(e => e.entity === entityName);
  const targetFields = entity ? entity.fields : {};

  tbody.innerHTML = sourceColumns.map((col, idx) => {
    // SourceColumn uses originalName (not name), inferredType (not detectedType)
    const colName = col.originalName || col.name || String(idx);
    const colType = col.inferredType || col.detectedType || 'STRING';
    const samples = col.sampleValues || [];
    const sampleVal = samples.length ? samples.slice(0, 2).map(v => String(v)).join(', ') : '-';

    // MappingSuggestion uses sourceColumn field
    const suggestion = suggestions.find(s => s.sourceColumn === colName || s.sourceColumn === col.normalizedName);
    const selectedTarget = savedMappings[colName]?.targetField || (suggestion ? (suggestion.suggestedTargetField || '') : '');
    const confidence = suggestion ? suggestion.confidence : '';
    const mappingReason = suggestion?.matchReason || '';
    const confidenceScore = suggestion?.confidenceScore != null ? Math.round(Number(suggestion.confidenceScore) * 100) : 0;
    const evidence = Array.isArray(suggestion?.evidence) ? suggestion.evidence : [];
    const techniques = Array.isArray(suggestion?.techniques) ? suggestion.techniques : [];
    const suggestedTransforms = Array.isArray(suggestion?.suggestedTransformations) ? suggestion.suggestedTransformations : [];

    // Determine the target field definition for smart defaults
    const targetFieldDef = selectedTarget ? (targetFields[selectedTarget] || Object.values(targetFields).find(f => f.name === selectedTarget)) : null;
    const targetFieldType = targetFieldDef?.type || '';

    // Auto-select smart transformation based on target field type
    // Priority: saved transform > type-inferred default > NONE
    const savedTransformList = savedTransforms[colName] || [];
    const savedTransformVal = savedTransformList.length > 0
      ? (typeof savedTransformList[0] === 'string' ? savedTransformList[0] : savedTransformList[0]?.type || 'NONE')
      : null;

    let defaultTransform = 'NONE';
    if (savedTransformVal) {
      defaultTransform = savedTransformVal;
    } else if (suggestedTransforms.length > 0) {
      defaultTransform = suggestedTransforms[0].type;
    } else if (selectedTarget) {
      // Safe schema fallback only when the backend did not return a sample-based recommendation.
      if (targetFieldType === 'PHONE') defaultTransform = 'PHONE_FORMAT';
      else if (targetFieldType === 'ENUM') defaultTransform = 'NORMALIZE_ENUM';
      else if (targetFieldType === 'STRING') defaultTransform = 'TRIM';
      else if (targetFieldType === 'EMAIL') defaultTransform = 'LOWERCASE';
      else if (targetFieldType === 'NUMBER') defaultTransform = 'TO_NUMBER';
      else if (targetFieldType === 'DECIMAL') defaultTransform = 'TO_DECIMAL';
      else if (targetFieldType === 'DATE') defaultTransform = 'TO_DATE';
      else if (targetFieldType === 'DATETIME') defaultTransform = 'TO_DATETIME';
      else if (targetFieldType === 'BOOLEAN') defaultTransform = 'TO_BOOLEAN';
    }

    const badgeClass = !selectedTarget ? 'badge-neutral'
      : confidence === 'HIGH' ? 'badge-success'
      : confidence === 'MEDIUM' ? 'badge-warning'
      : 'badge-info';

    // Only show confidence % if it is exactly 100; otherwise just show level label
    const badgeLabel = !selectedTarget
      ? 'Unmapped'
      : confidenceScore === 100
        ? `HIGH 100%`
        : confidence
          ? confidence.charAt(0) + confidence.slice(1).toLowerCase()
          : 'Mapped';

    // No technique tags, no evidence text, no transform hints — keep it clean
    const techniqueHtml = '';
    const evidenceHtml = '';
    const transformHint = '';

    return `
      <tr data-source-col="${escapeHtml(colName)}">
        <td>
          <strong>${escapeHtml(colName)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">Type: ${colType}</div>
        </td>
        <td style="font-family:var(--font-mono); font-size:0.8rem; color:#93c5fd;">${escapeHtml(sampleVal)}</td>
        <td>
          <select class="select select-target-field" data-col="${escapeHtml(colName)}">
            <option value="">-- Do Not Import --</option>
            ${Object.values(targetFields).map(f => `
              <option value="${f.name}" ${f.name === selectedTarget ? 'selected' : ''}>
                ${f.label} (${f.name})${f.required ? ' *' : ''}
              </option>
            `).join('')}
          </select>
        </td>
        <td>
          <select class="select select-transform-rule" data-col="${escapeHtml(colName)}">
            <option value="NONE" ${defaultTransform === 'NONE' ? 'selected' : ''}>No Transform</option>
            <option value="TRIM" ${defaultTransform === 'TRIM' ? 'selected' : ''}>Trim Whitespace</option>
            <option value="UPPERCASE" ${defaultTransform === 'UPPERCASE' ? 'selected' : ''}>UPPERCASE</option>
            <option value="NORMALIZE_ENUM" ${defaultTransform === 'NORMALIZE_ENUM' ? 'selected' : ''}>Normalize to allowed value</option>
            <option value="LOWERCASE" ${defaultTransform === 'LOWERCASE' ? 'selected' : ''}>lowercase</option>
            <option value="PHONE_FORMAT" ${defaultTransform === 'PHONE_FORMAT' ? 'selected' : ''}>Normalize Phone</option>
            <option value="TO_NUMBER" ${defaultTransform === 'TO_NUMBER' ? 'selected' : ''}>Convert to Whole Number</option>
            <option value="TO_DECIMAL" ${defaultTransform === 'TO_DECIMAL' ? 'selected' : ''}>Convert to Decimal</option>
            <option value="TO_DATE" ${defaultTransform === 'TO_DATE' ? 'selected' : ''}>Normalize Date</option>
            <option value="TO_DATETIME" ${defaultTransform === 'TO_DATETIME' ? 'selected' : ''}>Normalize Date & Time</option>
            <option value="TO_BOOLEAN" ${defaultTransform === 'TO_BOOLEAN' ? 'selected' : ''}>Normalize Boolean</option>
          </select>
        </td>
        <td style="min-width:160px;">
          <span class="badge ${badgeClass}">${escapeHtml(badgeLabel)}</span>
        </td>
      </tr>
    `;
  }).join('');

  // Update mapped/total stats pill
  updateMappingStatsPill();
}

async function autoMapUnmappedColumns(forceAll = false) {
  if (!state.currentImportId) return;
  try {
    // The backend is the single source of truth for mapping. Do not run a second
    // browser-side heuristic that can disagree with the server's rules/fuzzy/
    // semantic/type/pattern confidence calculation.
    await loadMappingSuggestions();
    const mapped = document.querySelectorAll('.select-target-field').length
      ? [...document.querySelectorAll('.select-target-field')].filter(el => el.value).length
      : 0;
    showToast(forceAll
      ? `Automatic mapping refreshed using rules, fuzzy, semantic, type and value-pattern signals. ${mapped} column(s) mapped.`
      : `Automatic mapping refreshed. ${mapped} column(s) have confident target matches.`, 'success');
  } catch (err) {
    showToast('Automatic mapping failed: ' + err.message, 'error');
  }
}

function updateMappingStatsPill() {
  const selects = document.querySelectorAll('.select-target-field');
  let mapped = 0;
  selects.forEach(s => { if (s.value) mapped++; });
  const pill = document.getElementById('mapping-stats-pill');
  if (pill) pill.textContent = `${mapped} of ${selects.length} fields mapped`;
}

function setupMappingEvents() {
  document.getElementById('btn-auto-map-unmapped')?.addEventListener('click', async () => {
    await autoMapUnmappedColumns(false);
  });

  document.getElementById('btn-auto-map-all')?.addEventListener('click', async () => {
    await autoMapUnmappedColumns(true);
  });

  document.getElementById('btn-step3-back')?.addEventListener('click', async () => {
    if (document.getElementById('btn-step3-back')?.dataset.draftAware === 'true') return;
    if (state.currentImportId) {
      try {
        const refreshed = await apiRequest(`/${state.currentImportId}`);
        state.currentImport = refreshed;
        showExistingFileOnStep2(refreshed);
      } catch (_) {}
    }
    goToWizardStep(2);
  });
  
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('select-target-field')) {
      updateMappingStatsPill();
      const row = e.target.closest('tr');
      if (row) {
        const badge = row.querySelector('.badge');
        if (badge) {
          if (e.target.value) {
            badge.className = 'badge badge-info';
            badge.textContent = 'Manual';
            badge.title = 'Manually selected target field';
          } else {
            badge.className = 'badge badge-neutral';
            badge.textContent = 'Unmapped';
            badge.title = 'Not mapped to any target field';
          }
        }
      }
    }
  });

  document.getElementById('btn-step3-validate-mapping')?.addEventListener('click', async () => {
    const mappings = extractMappingsFromTable();
    try {
      const res = await apiRequest(`/${state.currentImportId}/mapping/validate`, {
        method: 'POST',
        body: JSON.stringify({ columnMappings: mappings.reduce((acc, mapping) => {
          acc[mapping.sourceColumn] = {
            targetField: mapping.targetField,
            mappingMethod: 'MANUAL',
            enabled: true
          };
          return acc;
        }, {}) })
      });
      if (res.isValid) {
        showToast('Mapping valid! All required fields covered.', 'success');
      } else {
        const issues = res.errors || res.issues || [];
        showToast('Mapping issues: ' + (issues.length ? issues.map(e => typeof e === 'string' ? e : e.message).join(', ') : 'See unmapped required fields'), 'error');
      }
    } catch (err) {
      showToast('Mapping validation failed: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-step3-save')?.addEventListener('click', async () => {
    const mappings = extractMappingsFromTable();
    if (mappings.length === 0) {
      showToast('Please map at least one field before saving', 'error');
      return;
    }

    try {
      const saveRes = await apiRequest(`/${state.currentImportId}/mapping`, {
        method: 'POST',
        body: JSON.stringify({
          columnMappings: mappings.reduce((acc, mapping) => {
            acc[mapping.sourceColumn] = {
              targetField: mapping.targetField,
              mappingMethod: 'MANUAL',
              enabled: true,
              transformations: mapping.transformations || []
            };
            return acc;
          }, {})
        })
      });

      const refreshedAfterMapping = await apiRequest(`/${state.currentImportId}`);
      state.currentImport = refreshedAfterMapping;

      if (saveRes?.validation?.isValid === false || refreshedAfterMapping.status === 'MAPPING') {
        const issues = saveRes?.validation?.errors || [];
        showToast('Mapping saved with issues: ' + (issues.length ? (typeof issues[0] === 'string' ? issues.join(', ') : issues.map(i => i.message).join(', ')) : 'Unmapped required fields'), 'warning');
      } else {
        showToast('Mapping saved successfully.', 'success');
        goToWizardStep(4);
      }
    } catch (err) {
      showToast('Failed to save mapping: ' + err.message, 'error');
    }
  });
}

function extractMappingsFromTable() {
  const rows = document.querySelectorAll('#mapping-table-body tr');
  const mappings = [];
  rows.forEach(r => {
    const sourceColumn = r.dataset.sourceCol;
    const targetField = r.querySelector('.select-target-field')?.value;
    const transform = r.querySelector('.select-transform-rule')?.value;
    if (sourceColumn && targetField) {
      const transformations = [];
      if (transform && transform !== 'NONE') {
        transformations.push({ type: transform });
      }
      mappings.push({ sourceColumn, targetField, transformations });
    }
  });
  return mappings;
}

// -----------------------------------------------------------------------------
// STEP 4: TRANSFORMATION & VALIDATION (ENTERPRISE SCALABLE UX)
// -----------------------------------------------------------------------------

if (!state.valParams) {
  state.valParams = {
    page: 1,
    limit: 50,
    filterTab: 'NEEDS_ACTION',
    column: '',
    error: '',
    search: '',
    totalPages: 1,
    totalRecords: 0
  };
}

document.getElementById('btn-run-dataset-validation')?.addEventListener('click', async () => {
  await runValidationPipeline();
});

async function runValidationPipeline() {
  if (!state.currentImportId) return;
  try {
    showValidationLoading(true);
    const runButton = document.getElementById('btn-run-dataset-validation');
    if (runButton) runButton.disabled = true;
    const valRes = await apiRequest(`/${state.currentImportId}/validate`, {
      method: 'POST'
    });
    state.validationResult = valRes?.summary || valRes;
    state.validationStale = false;
    const refreshed = await apiRequest(`/${state.currentImportId}`);
    state.currentImport = refreshed;

    if (!['VALIDATING', 'VALIDATED', 'VALIDATION_FAILED'].includes(refreshed.status)) {
      throw new Error(`Validation did not complete a valid workflow transition (current state: ${refreshed.status})`);
    }

    state.valParams.page = 1;
    await loadValidationPreview();
  } catch (err) {
    showValidationLoading(false);
    showToast('Validation failed: ' + err.message, 'error');
  } finally {
    const runButton = document.getElementById('btn-run-dataset-validation');
    if (runButton) runButton.disabled = !hasPermission('DATA_IMPORT_VALIDATE');
  }
}

function showValidationLoading(loading) {
  const banner = document.getElementById('val-loading-banner');
  if (banner) banner.style.display = loading ? 'flex' : 'none';
}

async function loadValidationPreview() {
  if (!state.currentImportId) return;
  showValidationLoading(true);
  try {
    // 1. Fetch Authoritative Summary
    let summaryRes = null;
    try {
      summaryRes = await apiRequest(`/${state.currentImportId}/validation-summary`);
      if (summaryRes?.summary) state.validationResult = summaryRes.summary;
      if (summaryRes?.status) {
        if (!state.currentImport) state.currentImport = {};
        state.currentImport.status = summaryRes.status;
      }
    } catch (_) {}

    // 2. Build Server-Side Query
    const params = new URLSearchParams();
    params.set('page', state.valParams.page || 1);
    params.set('limit', state.valParams.limit || 50);

    const tab = state.valParams.filterTab || 'NEEDS_ACTION';
    if (tab === 'NEEDS_ACTION') {
      params.set('requiresAction', 'true');
    } else if (tab !== 'ALL') {
      params.set('status', tab);
    }

    if (state.valParams.column) params.set('column', state.valParams.column);
    if (state.valParams.error) params.set('errorCode', state.valParams.error);
    if (state.valParams.search) params.set('search', state.valParams.search);

    const previewRes = await apiRequest(`/${state.currentImportId}/validation-preview?${params.toString()}`);
    const records = Array.isArray(previewRes) ? previewRes : (previewRes?.data || previewRes?.records || []);
    const meta = previewRes?.meta || {};

    state.stagedRecords = records;
    if (meta.pagination) {
      state.valParams.page = meta.pagination.page;
      state.valParams.limit = meta.pagination.limit;
      state.valParams.totalPages = meta.pagination.totalPages || 1;
      state.valParams.totalRecords = meta.pagination.total || 0;
    }
    if (meta.validation) {
      state.validationResult = meta.validation;
    }

    // 3. Render Components
    renderValidation7Cards(state.validationResult);
    renderValidationResultMessage(state.validationResult, state.currentImport?.status);
    renderColumnQualitySummary(state.validationResult.columnStatistics || []);
    renderErrorGroups(state.validationResult.errorGroups || []);
    renderStagedProblemRecordsTable(state.stagedRecords);
    renderPaginationBar();

    const autoSec = document.getElementById('auto-corrected-section');
    if (autoSec) {
      if (state.valParams?.filterTab === 'CORRECTED') {
        autoSec.style.display = 'block';
        renderAutoCorrectedSection();
      } else {
        autoSec.style.display = 'none';
      }
    }

    // 4. Update Proceed to Matching Button
    const validationNext = document.getElementById('btn-step4-next');
    const invalidCount = Number(state.validationResult?.invalidRows || 0);
    if (validationNext) {
      const isReady = invalidCount === 0 && (state.currentImport?.status === 'VALIDATED' || meta.workflow?.canProceedToMatching);
      validationNext.disabled = !isReady;
      validationNext.title = !isReady
        ? `${invalidCount.toLocaleString()} records require correction before this import can continue.`
        : '';
    }
  } catch (err) {
    console.warn('Failed to load validation preview:', err);
  } finally {
    showValidationLoading(false);
  }
}

function renderValidationResultMessage(summary = {}, status = '') {
  const message = document.getElementById('validation-result-message');
  if (!message) return;

  const totalRows = Number(summary.totalRows || 0);
  const invalidRows = Number(summary.invalidRows || 0);
  const warningRows = Number(summary.warningRows || 0);
  const isValidated = status === 'VALIDATED';
  const allClear = totalRows === 0 || (invalidRows === 0 && warningRows === 0);

  if (!isValidated || !allClear) {
    message.style.display = 'none';
    message.textContent = '';
    return;
  }

  message.textContent = totalRows === 0
    ? 'Everything is validated. There are no records that require validation.'
    : 'Everything is validated. All records passed validation.';
  message.style.display = 'block';
}

function renderValidation7Cards(summary = {}) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val === undefined || val === null ? '—' : Number(val).toLocaleString();
  };

  const total = summary.totalRows ?? 0;
  const valid = summary.validRows ?? 0;
  const warning = summary.warningRows ?? 0;
  const invalid = summary.invalidRows ?? 0;
  const corrected = summary.correctedRows ?? 0;
  const duplicate = summary.duplicateRows ?? 0;
  const action = summary.rowsRequiringAction ?? (invalid + warning);

  set('val-stat-total', total);
  set('val-stat-valid', valid);
  set('val-stat-warning', warning);
  set('val-stat-invalid', invalid);
  set('val-stat-corrected', corrected);
  set('val-stat-needs-action', action);

  set('filter-cnt-needs-action', action);
  set('filter-cnt-invalid-pill', invalid);
  set('filter-cnt-warning-pill', warning);
  set('filter-cnt-dup-pill', duplicate);
  set('filter-cnt-corrected-pill', corrected);
  set('filter-cnt-valid-pill', valid);
  set('filter-cnt-all-pill', total);
}

function renderColumnQualitySummary(colStats = []) {
  const container = document.getElementById('col-quality-grid');
  const selectCol = document.getElementById('select-filter-column');
  if (!container) return;

  if (!colStats || colStats.length === 0) {
    container.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); grid-column: 1 / -1;">No column metrics recorded</div>';
    return;
  }

  if (selectCol) {
    const currentVal = state.valParams?.column || '';
    selectCol.innerHTML = '<option value="">All Columns</option>' + colStats.map(c => `
      <option value="${escapeHtml(c.field)}" ${c.field === currentVal ? 'selected' : ''}>
        ${escapeHtml(c.label || c.field)} (${c.invalid > 0 ? c.invalid + ' issues' : 'clean'})
      </option>
    `).join('');
  }

  container.innerHTML = colStats.map(c => `
    <div class="col-quality-card ${state.valParams?.column === c.field ? 'active' : ''}" onclick="selectValidationColumnFilter('${escapeHtml(c.field)}')">
      <div class="col-quality-head">
        <span class="col-quality-name">${escapeHtml(c.label || c.field)}</span>
        <span class="col-quality-type">${escapeHtml(c.type || 'STRING')}</span>
      </div>
      <div class="col-quality-metrics">
        <div class="col-metric-item">
          <span class="col-metric-val" style="color:#f8fafc;">${c.total.toLocaleString()}</span>
          <span class="col-metric-lbl">Total</span>
        </div>
        <div class="col-metric-item">
          <span class="col-metric-val" style="color:#34d399;">${c.valid.toLocaleString()}</span>
          <span class="col-metric-lbl">Valid</span>
        </div>
        <div class="col-metric-item">
          <span class="col-metric-val" style="color:${c.invalid > 0 ? '#f87171' : '#94a3b8'};">${c.invalid.toLocaleString()}</span>
          <span class="col-metric-lbl">Invalid</span>
        </div>
      </div>
    </div>
  `).join('');
}

window.selectValidationColumnFilter = function(field) {
  state.valParams.column = state.valParams.column === field ? '' : field;
  state.valParams.page = 1;
  const select = document.getElementById('select-filter-column');
  if (select) select.value = state.valParams.column;
  loadValidationPreview();
};

function renderErrorGroups(errorGroups = []) {
  const container = document.getElementById('error-groups-grid');
  const selectErr = document.getElementById('select-filter-error');
  if (!container) return;

  const validGroups = (errorGroups || []).filter(g => 
    !g.code?.toUpperCase().includes('DUPLICATE') && 
    !g.name?.toUpperCase().includes('DUPLICATE')
  );

  if (validGroups.length === 0) {
    container.innerHTML = '<div style="font-size:0.8rem; color:var(--success); grid-column: 1 / -1;">No active error groups — all data passed validation.</div>';
    if (selectErr) {
      selectErr.innerHTML = '<option value="">All Issue Types</option>';
    }
    return;
  }

  if (selectErr) {
    const currentVal = state.valParams?.error || '';
    selectErr.innerHTML = '<option value="">All Issue Types</option>' + validGroups.map(g => `
      <option value="${escapeHtml(g.code)}" ${g.code === currentVal ? 'selected' : ''}>
        ${escapeHtml(g.name)} (${g.count} records)
      </option>
    `).join('');
  }

  container.innerHTML = validGroups.map(g => {
    const examplesText = g.examples && g.examples.length ? g.examples.join(', ') : 'None';
    const colsText = g.affectedColumns && g.affectedColumns.length ? g.affectedColumns.join(', ') : 'Multiple';
    return `
      <div class="error-group-card">
        <div class="error-group-head">
          <span class="error-group-title">${escapeHtml(g.name)}</span>
          <span class="badge badge-danger">${g.count.toLocaleString()} records</span>
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted);">
          Affected: <strong>${escapeHtml(colsText)}</strong>
        </div>
        <div class="error-group-examples">
          <strong>Examples:</strong> ${escapeHtml(examplesText)}
        </div>
        <button class="btn btn-secondary btn-xs" onclick="selectValidationErrorFilter('${escapeHtml(g.code)}')">
          View All ${g.count.toLocaleString()} Affected Records
        </button>
      </div>
    `;
  }).join('');
}

window.selectValidationErrorFilter = function(code) {
  state.valParams.error = state.valParams.error === code ? '' : code;
  state.valParams.page = 1;
  const select = document.getElementById('select-filter-error');
  if (select) select.value = state.valParams.error;
  loadValidationPreview();
};

function getSchemaFieldForIssue(schema, fieldName) {
  if (!schema || !fieldName) return null;
  return schema.fields?.[fieldName]
    || Object.values(schema.fields || {}).find(f => f.name === fieldName || f.label === fieldName)
    || null;
}

function getSourceColumnForTarget(targetField, record) {
  const mapping = state.currentImport?.mapping?.columnMappings || state.columnMappings || {};
  for (const [source, def] of Object.entries(mapping)) {
    if (def?.targetField === targetField) return source;
  }
  const saved = state.currentMapping?.columnMappings || {};
  for (const [source, def] of Object.entries(saved)) {
    if (def?.targetField === targetField) return source;
  }
  if (record?.rawData && Object.prototype.hasOwnProperty.call(record.rawData, targetField)) return targetField;
  return targetField;
}

function renderStagedProblemRecordsTable(records = []) {
  const thead = document.getElementById('staged-records-thead');
  const tbody = document.getElementById('staged-records-tbody');
  const titleEl = document.getElementById('staged-table-title');
  const countEl = document.getElementById('staged-table-count');

  if (!thead || !tbody) return;

  const totalRecs = state.valParams.totalRecords || records.length;
  const startIdx = totalRecs > 0 ? (state.valParams.page - 1) * state.valParams.limit + 1 : 0;
  const endIdx = Math.min(startIdx + records.length - 1, totalRecs);

  const filterTab = state.valParams.filterTab || 'NEEDS_ACTION';
  const activeColFilter = state.valParams.column || '';

  if (titleEl) {
    const tabName =
      filterTab === 'CORRECTED' ? '✨ Auto-Corrected Column Transformations' :
      filterTab === 'NEEDS_ACTION' ? 'Records Requiring Attention' :
      filterTab === 'INVALID' ? 'Invalid Records' :
      filterTab === 'WARNING' ? 'Warning Records' :
      filterTab === 'DUPLICATE' ? 'Duplicate Records' :
      filterTab === 'VALID' ? 'Valid Dataset Records' : 'All Dataset Records';
    titleEl.textContent = tabName;
  }

  if (countEl) {
    countEl.textContent = `Showing ${startIdx.toLocaleString()}–${endIdx.toLocaleString()} of ${totalRecs.toLocaleString()} records`;
  }

  if (!records || records.length === 0) {
    thead.innerHTML = '';
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:24px;">No records match the selected filter criteria.</td></tr>`;
    return;
  }

  const targetEntityName = document.getElementById('select-target-entity')?.value || state.currentImport?.targetEntity || '';
  const schema = state.entities?.find(e => e.entity === targetEntityName) || state.selectedEntitySchema;

  // MODE A: AUTO-CORRECTED VIEW (filterTab === 'CORRECTED' or when viewing auto-corrected columns)
  if (filterTab === 'CORRECTED') {
    thead.innerHTML = `
      <tr>
        <th style="width:75px;">Row #</th>
        <th style="width:170px;">Auto-Corrected Column</th>
        <th style="width:200px;">Original Uploaded Value</th>
        <th style="width:200px;">Auto-Corrected Value</th>
        <th>Correction Applied / Rule</th>
        <th style="width:140px;">Status</th>
      </tr>
    `;

    const rowsHtml = [];
    records.forEach(r => {
      let transformations = r.transformationAudit || r.transformationsApplied || [];

      // If no explicit audit array logged, synthesize transformations by comparing rawData vs transformedData
      if (transformations.length === 0 && r.rawData && r.transformedData) {
        transformations = [];
        for (const k of Object.keys(r.rawData)) {
          const orig = r.rawData[k];
          const trans = r.transformedData[k];
          if (orig !== undefined && trans !== undefined && String(orig).trim() !== String(trans).trim()) {
            transformations.push({
              field: k,
              column: k,
              originalValue: orig,
              newValue: trans,
              rule: 'AUTO_FORMATTED'
            });
          }
        }
      }

      if (activeColFilter) {
        transformations = transformations.filter(t => (t.field || t.column) === activeColFilter);
      }

      if (transformations.length > 0) {
        transformations.forEach(t => {
          const colName = t.field || t.column || 'Column';
          const origVal = String(t.originalValue ?? r.rawData?.[colName] ?? 'EMPTY');
          const newVal = String(t.newValue ?? r.transformedData?.[colName] ?? '');
          const ruleStr = t.rule || t.transformationRule || t.reason || 'Auto-Sanitized';

          rowsHtml.push(`
            <tr>
              <td style="font-family:var(--font-mono);font-weight:600;">#${r.rowIndex ?? '-'}</td>
              <td><strong style="color:#a78bfa;font-family:monospace;font-size:0.9rem;">${escapeHtml(colName)}</strong></td>
              <td><code style="background:rgba(239, 68, 68, 0.12);color:#fca5a5;padding:3px 8px;border-radius:4px;font-size:0.85rem;">${escapeHtml(origVal)}</code></td>
              <td><code style="background:rgba(16, 185, 129, 0.15);color:#34d399;padding:3px 8px;border-radius:4px;font-size:0.85rem;">${escapeHtml(newVal)}</code></td>
              <td><span class="badge badge-info">${escapeHtml(ruleStr)}</span></td>
              <td><span class="badge badge-success" style="background:rgba(52, 211, 153, 0.15);color:#34d399;border:1px solid rgba(52, 211, 153, 0.3);">✨ AUTO_CORRECTED</span></td>
            </tr>
          `);
        });
      } else {
        const keys = Object.keys(r.transformedData || r.rawData || {}).slice(0, 3);
        const previewStr = keys.map(k => `${k}: ${r.transformedData?.[k] ?? r.rawData?.[k]}`).join(' | ');
        rowsHtml.push(`
          <tr>
            <td style="font-family:var(--font-mono);font-weight:600;">#${r.rowIndex ?? '-'}</td>
            <td colspan="4"><span class="badge badge-success">✨ AUTO_CORRECTED</span> <span style="font-size:0.85rem;color:#cbd5e1;">${escapeHtml(previewStr || 'Record transformed successfully')}</span></td>
            <td><span class="text-muted" style="font-size:0.75rem;">Verified</span></td>
          </tr>
        `);
      }
    });

    tbody.innerHTML = rowsHtml.join('');
    return;
  }

  // MODE B: VALID RECORDS VIEW (filterTab === 'VALID')
  if (filterTab === 'VALID') {
    const sampleRecord = records[0] || {};
    const recordObj = sampleRecord.transformedData || sampleRecord.rawData || {};
    const colKeys = Object.keys(recordObj).slice(0, 5);

    thead.innerHTML = `
      <tr>
        <th style="width:75px;">Row #</th>
        <th style="width:110px;">Status</th>
        ${colKeys.map(c => `<th>${escapeHtml(c)}</th>`).join('')}
        <th style="width:150px;">Validation Info</th>
      </tr>
    `;

    tbody.innerHTML = records.map(r => {
      const dataObj = r.transformedData || r.rawData || {};
      const colsHtml = colKeys.map(c => `
        <td style="font-family:var(--font-mono);font-size:0.85rem;color:#f8fafc;">${escapeHtml(String(dataObj[c] ?? ''))}</td>
      `).join('');

      return `
        <tr>
          <td style="font-family:var(--font-mono);font-weight:600;">#${r.rowIndex ?? '-'}</td>
          <td><span class="badge badge-success">VALID</span></td>
          ${colsHtml}
          <td><span class="text-muted" style="font-size:0.78rem;">✓ Clean record</span></td>
        </tr>
      `;
    }).join('');

    return;
  }

  // MODE C: ALL RECORDS VIEW (filterTab === 'ALL')
  if (filterTab === 'ALL') {
    thead.innerHTML = `
      <tr>
        <th style="width:75px;">Row #</th>
        <th style="width:130px;">Status</th>
        <th>Record Summary / Transformations / Issues</th>
        <th style="width:180px;">Action / Details</th>
      </tr>
    `;

    tbody.innerHTML = records.map(r => {
      const errors = r.validationErrors || [];
      const transformations = r.transformationAudit || r.transformationsApplied || [];
      const isVal = r.status === 'VALID';
      const isAuto = r.status === 'AUTO_CORRECTED' || transformations.length > 0;

      if (errors.length > 0) {
        const errList = errors.map(e => `${e.field}: ${e.message}`).join('; ');
        return `
          <tr>
            <td style="font-family:var(--font-mono);font-weight:600;">#${r.rowIndex ?? '-'}</td>
            <td><span class="badge badge-danger">${r.status || 'INVALID'}</span></td>
            <td><div style="font-size:0.82rem;color:#f87171;">${escapeHtml(errList)}</div></td>
            <td><button class="btn btn-secondary btn-xs" onclick="selectValidationFilterTab('NEEDS_ACTION')">Fix Issues</button></td>
          </tr>
        `;
      }

      if (isAuto) {
        const transList = transformations.map(t => `${t.field || t.column}: ${t.originalValue} ➔ ${t.newValue}`).join(' | ');
        return `
          <tr>
            <td style="font-family:var(--font-mono);font-weight:600;">#${r.rowIndex ?? '-'}</td>
            <td><span class="badge badge-success">AUTO_CORRECTED</span></td>
            <td><div style="font-size:0.82rem;color:#34d399;">✨ Transformed: ${escapeHtml(transList || 'Fields auto-corrected')}</div></td>
            <td><span class="text-muted" style="font-size:0.75rem;">Verified</span></td>
          </tr>
        `;
      }

      const sampleObj = r.transformedData || r.rawData || {};
      const sampleStr = Object.entries(sampleObj).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' | ');

      return `
        <tr>
          <td style="font-family:var(--font-mono);font-weight:600;">#${r.rowIndex ?? '-'}</td>
          <td><span class="badge badge-success">VALID</span></td>
          <td><div style="font-size:0.82rem;color:#cbd5e1;">${escapeHtml(sampleStr)}</div></td>
          <td><span class="text-muted" style="font-size:0.75rem;">✓ Valid</span></td>
        </tr>
      `;
    }).join('');

    return;
  }

  // MODE D: NEEDS ACTION / INVALID / WARNING / DUPLICATE (Problem records to correct)
  thead.innerHTML = `
    <tr>
      <th style="width:70px;">Row</th>
      <th style="width:120px;">Column</th>
      <th style="width:130px;">Error Type</th>
      <th style="width:140px;">Current Value</th>
      <th>Problem & Guidance</th>
      <th>Suggested Fix</th>
      <th style="width:170px;">Action</th>
    </tr>
  `;

  tbody.innerHTML = records.map(r => {
    const errors = r.validationErrors || [];
    const isVal = r.status === 'VALID';
    const isAuto = r.status === 'AUTO_CORRECTED';

    if (errors.length === 0) {
      const statusBadgeClass = isVal ? 'badge-success' : isAuto ? 'badge-info' : 'badge-warning';
      return `
        <tr>
          <td style="font-family:var(--font-mono);font-weight:600;">#${r.rowIndex ?? '-'}</td>
          <td colspan="5"><span class="badge ${statusBadgeClass}">${r.status}</span> Record passed validation checks</td>
          <td><span class="text-muted" style="font-size:0.75rem;">No action required</span></td>
        </tr>
      `;
    }

    const issueCells = errors.map((err, i) => {
      const field = err.field || 'Field';
      const sourceColumn = getSourceColumnForTarget(field, r);
      const rawVal = r.rawData?.[sourceColumn] ?? err.sourceValue ?? '';
      const currentValStr = String(rawVal ?? '');
      const fieldDef = getSchemaFieldForIssue(schema, field);
      const type = fieldDef?.type || 'STRING';

      let inputControlHtml = '';
      if (type === 'ENUM' && Array.isArray(fieldDef?.enumValues) && fieldDef.enumValues.length) {
        inputControlHtml = `
          <select id="fix-${r.id}-${i}" class="select select-sm fix-input" style="min-width:140px;">
            <option value="">Select allowed value…</option>
            ${fieldDef.enumValues.map(ev => `<option value="${escapeHtml(ev)}" ${currentValStr.toUpperCase() === String(ev).toUpperCase() ? 'selected' : ''}>${escapeHtml(ev)}</option>`).join('')}
          </select>
        `;
      } else {
        const expectedHint = err.details?.expectedFormat || (type === 'NUMBER' ? '1250' : type === 'DATE' ? 'YYYY-MM-DD' : 'Valid value');
        inputControlHtml = `
          <input id="fix-${r.id}-${i}" type="text" class="input input-sm fix-input" value="${escapeHtml(currentValStr)}" placeholder="${escapeHtml(expectedHint)}" style="min-width:140px;" />
        `;
      }

      const rowData = r.transformedData || r.rawData || {};
      const allColsPills = Object.entries(rowData)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => {
          const isErrField = k === field || k === sourceColumn;
          const bg = isErrField ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 41, 59, 0.6)';
          const border = isErrField ? '1px solid #f87171' : '1px solid var(--border-color)';
          const textColor = isErrField ? '#fca5a5' : '#93c5fd';
          return `<span style="display:inline-block; background:${bg}; border:${border}; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-family:var(--font-mono); margin-right:4px; margin-bottom:4px;"><strong>${escapeHtml(k)}:</strong> <span style="color:${textColor};">${escapeHtml(String(v ?? ''))}</span></span>`;
        }).join('');

      const completeRowHtml = `
        <div style="margin-top:6px; padding:6px 8px; background:rgba(15, 23, 42, 0.7); border:1px solid rgba(148, 163, 184, 0.2); border-radius:6px;">
          <div style="font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Complete Row #${r.rowIndex ?? '-'} Data:</div>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">${allColsPills || '<em>No column values</em>'}</div>
        </div>
      `;

      return {
        fieldHtml: `<div style="padding:8px 0;${i ? 'border-top:1px solid var(--border-color);' : ''}"><strong style="color:#f8fafc;">${escapeHtml(field)}</strong></div>`,
        errorHtml: `<div style="padding:8px 0;${i ? 'border-top:1px solid var(--border-color);' : ''}"><span class="badge ${err.severity === 'WARNING' ? 'badge-warning' : 'badge-danger'}">${escapeHtml(err.code || 'ERROR')}</span></div>`,
        valueHtml: `<div style="padding:8px 0;${i ? 'border-top:1px solid var(--border-color);' : ''}"><code style="background:var(--bg-surface);padding:2px 6px;border-radius:4px;color:#cbd5e1;">${escapeHtml(currentValStr || 'EMPTY')}</code></div>`,
        problemHtml: `
          <div style="padding:8px 0;${i ? 'border-top:1px solid var(--border-color);' : ''}">
            <div style="font-size:0.78rem;color:#f87171;font-weight:500;">${escapeHtml(err.message || 'Invalid value')}</div>
            ${err.details?.action ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">Fix: ${escapeHtml(err.details.action)}</div>` : ''}
            ${completeRowHtml}
          </div>
        `,
        fixHtml: `<div style="padding:8px 0;${i ? 'border-top:1px solid var(--border-color);' : ''}">${inputControlHtml}</div>`,
        actionHtml: `
          <div style="padding:8px 0;${i ? 'border-top:1px solid var(--border-color);' : ''}">
            <button class="btn btn-primary btn-xs" onclick="applySingleRecordCorrection('${r.id}', '${escapeHtml(field)}', 'fix-${r.id}-${i}', this)">
              Correct
            </button>
          </div>
        `
      };
    });

    // One staged dataset record can have several field issues. Keep it on one
    // table row and stack the corresponding issue details and corrections.
    return `
      <tr>
        <td style="font-family:var(--font-mono);font-weight:600;vertical-align:top;">#${r.rowIndex ?? '-'}</td>
        <td style="vertical-align:top;">${issueCells.map(issue => issue.fieldHtml).join('')}</td>
        <td style="vertical-align:top;">${issueCells.map(issue => issue.errorHtml).join('')}</td>
        <td style="vertical-align:top;">${issueCells.map(issue => issue.valueHtml).join('')}</td>
        <td style="vertical-align:top;">${issueCells.map(issue => issue.problemHtml).join('')}</td>
        <td style="vertical-align:top;">${issueCells.map(issue => issue.fixHtml).join('')}</td>
        <td style="vertical-align:top;">${issueCells.map(issue => issue.actionHtml).join('')}</td>
      </tr>
    `;
  }).join('');
}

window.applySingleRecordCorrection = async function(recordId, field, inputId, btnEl) {
  const inputEl = document.getElementById(inputId);
  if (!inputEl) return;
  const newValue = inputEl.value;

  btnEl.disabled = true;
  btnEl.textContent = 'Fixing…';
  try {
    const res = await apiRequest(`/${state.currentImportId}/records/${recordId}/correct`, {
      method: 'PATCH',
      body: JSON.stringify({ field, newValue })
    });
    showToast('Record corrected and revalidated.', 'success');
    await loadValidationPreview();
  } catch (err) {
    btnEl.disabled = false;
    btnEl.textContent = 'Correct';
    showToast('Correction failed: ' + err.message, 'error');
  }
};

window.triggerBulkCorrection = async function(field, oldValue, inputId, errorCode, btnEl) {
  const inputEl = document.getElementById(inputId);
  if (!inputEl) return;
  const newValue = inputEl.value;

  if (!confirm(`Apply correction '${newValue}' to ALL affected records for column '${field}'?`)) return;

  btnEl.disabled = true;
  btnEl.textContent = 'Applying Bulk Fix…';
  try {
    const res = await apiRequest(`/${state.currentImportId}/records/bulk-correct`, {
      method: 'POST',
      body: JSON.stringify({ field, oldValue, newValue, errorCode })
    });
    showToast(`Bulk correction applied to ${res.data?.correctedCount || 'all'} records!`, 'success');
    await loadValidationPreview();
  } catch (err) {
    btnEl.disabled = false;
    btnEl.textContent = '⚡ Apply to All';
    showToast('Bulk correction failed: ' + err.message, 'error');
  }
};

function renderPaginationBar() {
  const prevBtn = document.getElementById('btn-page-prev');
  const nextBtn = document.getElementById('btn-page-next');
  const pageInfo = document.getElementById('pagination-pages-info');
  const selectSize = document.getElementById('select-page-size');

  const currentPage = state.valParams.page || 1;
  const totalPages = state.valParams.totalPages || 1;

  if (pageInfo) pageInfo.textContent = `Page ${currentPage.toLocaleString()} of ${totalPages.toLocaleString()}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (selectSize) selectSize.value = state.valParams.limit || 50;
}

function renderAutoCorrectedSection() {
  const container = document.getElementById('auto-corrected-section');
  const colsGrid = document.getElementById('auto-corrected-cols-grid');
  const totalBadge = document.getElementById('auto-corrected-total-badge');
  if (!container || !colsGrid) return;

  const corrections = state.validationResult?.correctionsSummary || [];
  const groupedByCol = {};
  let totalCount = 0;

  corrections.forEach(c => {
    const col = c.column || 'Unknown Column';
    if (!groupedByCol[col]) {
      groupedByCol[col] = { column: col, totalRecords: 0, items: [] };
    }
    const itemCnt = Number(c.count || 1);
    groupedByCol[col].totalRecords += itemCnt;
    totalCount += itemCnt;
    groupedByCol[col].items.push(c);
  });

  if (totalBadge) {
    totalBadge.textContent = `${totalCount.toLocaleString()} Transformations`;
  }

  const colsList = Object.values(groupedByCol);
  if (colsList.length === 0) {
    colsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-muted); text-align: center;">
        No automatic field transformations or corrections recorded for this dataset.
      </div>
    `;
    return;
  }

  colsGrid.innerHTML = colsList.map(g => `
    <div class="col-quality-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
          <strong style="font-size: 0.92rem; color: var(--text-main); font-family: monospace;">${escapeHtml(g.column)}</strong>
          <span class="badge badge-info" style="font-size: 0.72rem;">${g.totalRecords.toLocaleString()} records</span>
        </div>
        <p style="margin: 0; font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
          Rules: ${escapeHtml(g.items.map(i => i.reason).join(', '))}
        </p>
      </div>
      <button class="btn btn-secondary btn-xs" type="button" onclick="openAutoCorrectionColumnDrilldown('${escapeHtml(g.column)}')" style="align-self: flex-start; border-color: var(--primary); color: #a78bfa;">
        🔍 View Corrections
      </button>
    </div>
  `).join('');
}

window.openAutoCorrectionColumnDrilldown = function(colName) {
  state.drilldownCol = colName;
  state.drilldownPage = 1;
  const panel = document.getElementById('auto-corrected-drilldown-panel');
  if (panel) panel.style.display = 'block';
  renderAutoCorrectionDrilldownTable();

  // Sync main validation controls & table records
  state.valParams.column = colName;
  state.valParams.filterTab = 'CORRECTED';
  state.valParams.page = 1;

  document.querySelectorAll('.val-pill').forEach(b => b.classList.remove('active'));
  document.querySelector('.val-pill[data-filter="CORRECTED"]')?.classList.add('active');

  const select = document.getElementById('select-filter-column');
  if (select) select.value = colName;

  loadValidationPreview();
};

function renderAutoCorrectionDrilldownTable() {
  const panel = document.getElementById('auto-corrected-drilldown-panel');
  const tbody = document.getElementById('drilldown-table-tbody');
  const title = document.getElementById('drilldown-col-title');
  const subtitle = document.getElementById('drilldown-col-subtitle');
  const countInfo = document.getElementById('drilldown-count-info');
  const pagesInfo = document.getElementById('drilldown-pages-info');
  const btnPrev = document.getElementById('btn-drilldown-prev');
  const btnNext = document.getElementById('btn-drilldown-next');
  if (!tbody || !state.drilldownCol) return;

  const corrections = state.validationResult?.correctionsSummary || [];
  const colItems = corrections.filter(c => c.column === state.drilldownCol);

  if (title) title.textContent = `Transformation Drill-down: ${state.drilldownCol}`;
  if (subtitle) subtitle.textContent = `Original vs Corrected values for column '${state.drilldownCol}'`;

  const page = state.drilldownPage || 1;
  const limit = 25;
  const total = colItems.length;
  const totalPages = Math.ceil(total / limit) || 1;

  const start = (page - 1) * limit;
  const end = Math.min(start + limit, total);
  const pageSlice = colItems.slice(start, end);

  if (pageSlice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No corrections recorded for column ${escapeHtml(state.drilldownCol)}</td></tr>`;
  } else {
    tbody.innerHTML = pageSlice.map(c => `
      <tr>
        <td><code style="font-weight: 600; color: #a78bfa;">${escapeHtml(c.column)}</code></td>
        <td><code style="background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 2px 6px; border-radius: 4px;">${escapeHtml(c.originalValue || 'EMPTY')}</code></td>
        <td><code style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 2px 6px; border-radius: 4px;">${escapeHtml(c.correctedValue)}</code></td>
        <td><span class="badge badge-info">${escapeHtml(c.reason)}</span></td>
        <td class="text-right"><strong>${Number(c.count || 1).toLocaleString()}</strong></td>
      </tr>
    `).join('');
  }

  if (countInfo) countInfo.textContent = total > 0 ? `Showing ${start + 1}–${end} of ${total}` : `Showing 0 of 0`;
  if (pagesInfo) pagesInfo.textContent = `Page ${page} of ${totalPages}`;
  if (btnPrev) btnPrev.disabled = page <= 1;
  if (btnNext) btnNext.disabled = page >= totalPages;
}

window.openAutoCorrectionsModal = function() {
  const modal = document.getElementById('modal-auto-corrections');
  const backdrop = document.getElementById('modal-corrections-backdrop');
  const tbody = document.getElementById('auto-corrections-tbody');
  if (!modal || !backdrop || !tbody) return;

  const corrections = state.validationResult?.correctionsSummary || [];
  if (corrections.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No automatic corrections recorded for this dataset.</td></tr>';
  } else {
    tbody.innerHTML = corrections.map(c => `
      <tr>
        <td><strong>${escapeHtml(c.column)}</strong></td>
        <td><code>${escapeHtml(c.originalValue || 'EMPTY')}</code></td>
        <td><code style="color:var(--success);">${escapeHtml(c.correctedValue)}</code></td>
        <td><span class="badge badge-info">${escapeHtml(c.reason)}</span></td>
        <td><strong>${c.count.toLocaleString()}</strong></td>
      </tr>
    `).join('');
  }

  modal.style.display = 'block';
  backdrop.style.display = 'block';
};

window.closeAutoCorrectionsModal = function() {
  const modal = document.getElementById('modal-auto-corrections');
  const backdrop = document.getElementById('modal-corrections-backdrop');
  if (modal) modal.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
};

window.openSaveDraftModal = function() {
  const modal = document.getElementById('modal-save-draft');
  const backdrop = document.getElementById('modal-draft-backdrop');
  if (modal && backdrop) {
    modal.style.display = 'block';
    backdrop.style.display = 'block';
  }
};

window.closeSaveDraftModal = function() {
  const modal = document.getElementById('modal-save-draft');
  const backdrop = document.getElementById('modal-draft-backdrop');
  if (modal) modal.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
};

async function loadValidationState() {
  if (!state.currentImportId) return;
  try {
    const refreshed = await apiRequest(`/${state.currentImportId}`);
    state.currentImport = refreshed;

    if (['PARSED', 'MAPPING', 'MAPPED'].includes(state.currentImport.status)) {
      goToWizardStep(3);
      return;
    }

    const badge = document.getElementById('active-job-status-badge');
    if (badge) {
      badge.textContent = state.currentImport.status || 'DRAFT';
      badge.className = `badge badge-${getStatusBadgeClass(state.currentImport.status)}`;
    }

    state.valParams.page = 1;
    await loadValidationPreview();
  } catch (err) {
    console.warn('Failed to load validation state:', err);
  }
}

function setupValidationEvents() {
  // Navigation & Save Draft
  document.getElementById('btn-step4-back')?.addEventListener('click', async () => {
    if (document.getElementById('btn-step4-back')?.dataset.draftAware === 'true') return;
    if (state.currentImportId) {
      try {
        await loadMappingSuggestions();
      } catch (err) {
        showToast('Could not reload mapping draft: ' + err.message, 'error');
      }
    }
    goToWizardStep(3);
  });

  document.getElementById('btn-step4-save-draft')?.addEventListener('click', saveDraftAndReturnToPreviousStep);
  document.getElementById('btn-step4-save-draft-footer')?.addEventListener('click', saveDraftAndReturnToPreviousStep);
  document.getElementById('btn-view-auto-corrections')?.addEventListener('click', () => {
    const correctedPill = document.querySelector('.val-pill[data-filter="CORRECTED"]');
    if (correctedPill) correctedPill.click();
    else openAutoCorrectionsModal();
  });

  document.getElementById('btn-close-auto-corrected')?.addEventListener('click', () => {
    const sec = document.getElementById('auto-corrected-section');
    if (sec) sec.style.display = 'none';
  });

  document.getElementById('btn-close-drilldown')?.addEventListener('click', () => {
    const panel = document.getElementById('auto-corrected-drilldown-panel');
    if (panel) panel.style.display = 'none';
  });

  document.getElementById('btn-drilldown-prev')?.addEventListener('click', () => {
    if ((state.drilldownPage || 1) > 1) {
      state.drilldownPage--;
      renderAutoCorrectionDrilldownTable();
    }
  });

  document.getElementById('btn-drilldown-next')?.addEventListener('click', () => {
    state.drilldownPage = (state.drilldownPage || 1) + 1;
    renderAutoCorrectionDrilldownTable();
  });

  document.getElementById('btn-reset-val-filters')?.addEventListener('click', () => {
    state.valParams.filterTab = 'NEEDS_ACTION';
    state.valParams.column = '';
    state.valParams.error = '';
    state.valParams.search = '';
    state.valParams.page = 1;

    document.querySelectorAll('.val-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('.val-pill[data-filter="NEEDS_ACTION"]')?.classList.add('active');

    const colSelect = document.getElementById('select-filter-column');
    const errSelect = document.getElementById('select-filter-error');
    const searchInput = document.getElementById('input-filter-search');
    if (colSelect) colSelect.value = '';
    if (errSelect) errSelect.value = '';
    if (searchInput) searchInput.value = '';

    loadValidationPreview();
  });

  // Toggle Column Quality Breakdown
  document.getElementById('toggle-col-quality')?.addEventListener('click', () => {
    const body = document.getElementById('col-quality-body');
    const label = document.getElementById('col-quality-toggle-label');
    if (body) {
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      if (label) label.textContent = isHidden ? 'Collapse Column Breakdown ▲' : 'Expand Column Breakdown ▼';
    }
  });

  // Next Step (Proceed to Matching)
  document.getElementById('btn-step4-next')?.addEventListener('click', async () => {
    const summaryInvalid = Number(state.validationResult?.invalidRows || 0);
    if (summaryInvalid > 0) {
      showToast(`${summaryInvalid} records require correction before this import can continue.`, 'error');
      return;
    }
    const next = document.getElementById('btn-step4-next');
    if (next) { next.disabled = true; next.textContent = 'Scanning duplicates…'; }
    const ok = await runDuplicateScan();
    if (next) { next.disabled = false; next.textContent = 'Proceed to Duplicate Matching'; }
    if (ok) goToWizardStep(5);
  });

  // Filter Pills
  document.querySelectorAll('.val-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.val-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.valParams.filterTab = btn.dataset.filter || 'NEEDS_ACTION';
      state.valParams.page = 1;
      loadValidationPreview();
    });
  });

  // Column Dropdown Filter
  document.getElementById('select-filter-column')?.addEventListener('change', (e) => {
    state.valParams.column = e.target.value;
    state.valParams.page = 1;
    loadValidationPreview();
  });

  // Error Dropdown Filter
  document.getElementById('select-filter-error')?.addEventListener('change', (e) => {
    state.valParams.error = e.target.value;
    state.valParams.page = 1;
    loadValidationPreview();
  });

  // Search Input Debounced
  let searchTimeout = null;
  document.getElementById('input-filter-search')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.valParams.search = e.target.value;
      state.valParams.page = 1;
      loadValidationPreview();
    }, 300);
  });

  // Page Size Selector
  document.getElementById('select-page-size')?.addEventListener('change', (e) => {
    state.valParams.limit = Number(e.target.value) || 50;
    state.valParams.page = 1;
    loadValidationPreview();
  });

  // Pagination Controls
  document.getElementById('btn-page-prev')?.addEventListener('click', () => {
    if (state.valParams.page > 1) {
      state.valParams.page--;
      loadValidationPreview();
    }
  });

  document.getElementById('btn-page-next')?.addEventListener('click', () => {
    if (state.valParams.page < state.valParams.totalPages) {
      state.valParams.page++;
      loadValidationPreview();
    }
  });
}

// -----------------------------------------------------------------------------
// STEP 5: DUPLICATE DETECTION & MATCHING
// -----------------------------------------------------------------------------
// STEP 5: DUPLICATE DETECTION & MATCHING
// -----------------------------------------------------------------------------

function resetStep5DuplicateUi() {
  state.duplicateResult = null;
  const emptyState = document.getElementById('duplicate-empty-state');
  const findingsContainer = document.getElementById('duplicate-findings-container');
  const groupsList = document.getElementById('duplicate-groups-list');
  const badge = document.getElementById('duplicate-findings-count-badge');
  const emptyTitle = document.getElementById('duplicate-empty-title');
  const emptyDesc = document.getElementById('duplicate-empty-desc');
  const resolvedSection = document.getElementById('duplicate-resolved-section');
  const resolvedList = document.getElementById('duplicate-resolved-list');
  const resolvedBadge = document.getElementById('duplicate-resolved-count-badge');

  if (emptyState) {
    emptyState.style.display = 'block';
    if (emptyTitle) emptyTitle.textContent = 'No duplicate scan has been run yet.';
    if (emptyDesc) {
      emptyDesc.innerHTML = 'Click <strong>Run Duplicate Scan</strong> to analyze the validated records, group genuine duplicates, and match against existing database entities.';
    }
  }
  if (findingsContainer) findingsContainer.style.display = 'none';
  if (groupsList) groupsList.innerHTML = '';
  if (badge) badge.textContent = '0 GROUPS';
  if (resolvedSection) resolvedSection.style.display = 'none';
  if (resolvedList) resolvedList.innerHTML = '';
  if (resolvedBadge) resolvedBadge.textContent = '0 Resolved';

  // Reset counters until user explicitly runs scan
  const counterIds = [
    'match-cnt-new', 'match-cnt-matched', 'match-cnt-infile',
    'match-cnt-skipped', 'match-cnt-review',
    'match-cnt-groups', 'match-cnt-updated'
  ];
  counterIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = '0';
  });
}

function renderMatchingCounters(summary) {
  if (!summary) return;
  const activeGroups = (summary.duplicateGroups || []).filter(group => {
    if (group.isResolved || group.status === 'RESOLVED') return false;
    const k = String(group.matchKey || '').trim().toUpperCase();
    if (!k || k.includes('###') || k.includes('INVALID')) return false;
    return (group.records || []).some(record =>
      ['REVIEW', 'BLOCKED'].includes(String(record.resolutionAction || '').toUpperCase())
    );
  });

  const unresolvedCount = activeGroups.reduce(
    (count, group) => count + (group.records || []).filter(record =>
      ['REVIEW', 'BLOCKED'].includes(String(record.resolutionAction || '').toUpperCase())
    ).length,
    0
  );

  const inFileDataDuplicates = activeGroups.reduce(
    (count, group) => count + (group.records || []).filter(record =>
      !record.isPrimary && record.role !== 'PRIMARY'
    ).length,
    0
  );

  const values = {
    'match-cnt-groups': activeGroups.length,
    'match-cnt-updated': summary.resolvedUpdates ?? 0,
    'match-cnt-new': summary.creates ?? summary.newRecords ?? 0,
    'match-cnt-matched': summary.updates ?? summary.existingRecords ?? 0,
    'match-cnt-infile': summary.duplicateInFile !== undefined ? summary.duplicateInFile : inFileDataDuplicates,
    'match-cnt-skipped': (summary.skips ?? 0) + (summary.rejected ?? 0),
    'match-cnt-review': summary.reviews !== undefined ? summary.reviews : unresolvedCount
  };
  for (const [id, value] of Object.entries(values)) {
    const element = document.getElementById(id);
    if (element) element.textContent = Number(value).toLocaleString();
  }
}

async function runDuplicateScan() {
  if (!state.currentImportId) return false;
  // Step 5 resolves duplicates individually, so do not auto-resolve them from
  // the import's default strategy before the user can review the matching rows.
  const strategy = 'SEND_FOR_REVIEW';

  const runBtn = document.getElementById('btn-run-duplicate-check');
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin 0.75s linear infinite; margin-right:6px; vertical-align:middle;"></span> Scanning...';
  }

  try {
    const matchRes = await apiRequest(`/${state.currentImportId}/detect-duplicates`, {
      method: 'POST',
      body: JSON.stringify({ overrideStrategy: strategy })
    });
    if (state.currentImport) {
      if (!state.currentImport.importOptions) state.currentImport.importOptions = {};
      state.currentImport.importOptions.duplicateStrategy = strategy;
    }
    state.duplicateResult = matchRes;
    renderMatchingCounters(matchRes);

    renderDuplicateGroups([
      ...(matchRes.duplicateGroups || []),
      ...(matchRes.resolvedDuplicateGroups || [])
    ]);

    const activeGroups = (matchRes.duplicateGroups || []).filter(group => {
      if (group.isResolved || group.status === 'RESOLVED') return false;
      const k = String(group.matchKey || '').trim().toUpperCase();
      if (!k || k.includes('###') || k.includes('INVALID')) return false;
      return (group.records || []).some(record =>
        ['REVIEW', 'BLOCKED'].includes(String(record.resolutionAction || '').toUpperCase())
      );
    });

    if (activeGroups.length === 0) {
      showToast('Duplicate scan complete: No duplicates found! All records are unique.', 'success');
    } else {
      showToast(`Duplicate scan complete: Found ${activeGroups.length} duplicate group(s).`, 'info');
    }
    return true;
  } catch (err) {
    showToast('Duplicate scan failed: ' + err.message, 'error');
    return false;
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = 'Run Duplicate Scan';
    }
  }
}

function setupMatchingEvents() {
  document.getElementById('btn-step5-back')?.addEventListener('click', () => {
    if (document.getElementById('btn-step5-back')?.dataset.draftAware === 'true') return;
    goToWizardStep(4);
  });

  document.getElementById('btn-run-duplicate-check')?.addEventListener('click', async () => {
    await runDuplicateScan();
  });

  document.getElementById('btn-step5-next')?.addEventListener('click', async () => {
    await runDuplicateScan();
    await loadReviewSummary();
    goToWizardStep(6);
  });

  document.getElementById('btn-cancel-resolution')?.addEventListener('click', window.closeResolutionModal);
  document.getElementById('btn-confirm-resolution')?.addEventListener('click', confirmDuplicateResolution);
  document.getElementById('modal-resolution-backdrop')?.addEventListener('click', window.closeResolutionModal);
  document.addEventListener('click', event => {
    const popup = document.getElementById('duplicate-actions-popup');
    if (popup && !popup.contains(event.target) && !event.target.closest('.duplicate-actions-trigger')) {
      window.closeDuplicateActions();
    }
  });
  document.addEventListener('scroll', window.closeDuplicateActions, true);
  window.addEventListener('resize', window.closeDuplicateActions);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') window.closeDuplicateActions();
  });
  document.addEventListener('keydown', event => {
    const resolutionDialog = document.getElementById('modal-resolution');
    if (resolutionDialog?.style.display === 'block') {
      trapDialogKeyboard(event, resolutionDialog, window.closeResolutionModal);
      return;
    }
    const editDialog = document.getElementById('modal-edit-duplicate-record');
    if (editDialog?.style.display === 'block') {
      trapDialogKeyboard(event, editDialog, window.closeEditDuplicateModal);
    }
  });
}

function findDuplicateRecord(recordId) {
  const allGroups = [
    ...(state.duplicateResult?.duplicateGroups || []),
    ...(state.duplicateResult?.resolvedDuplicateGroups || [])
  ];
  return allGroups
    ?.flatMap(group => group.records || [])
    .find(record => record.recordId === recordId);
}

function restoreDuplicateAction(recordId) {
  const select = document.getElementById(`duplicate-action-${recordId}`);
  const record = findDuplicateRecord(recordId);
  if (!select) return;
  const action = String(record?.resolutionAction || '').toUpperCase();
  select.value = ['SKIP', 'REJECT', 'UPDATE'].includes(action) ? action : '';
}

function setModalOpen(wrapperId, modalId, backdropId) {
  const wrapper = document.getElementById(wrapperId);
  const modal = document.getElementById(modalId);
  const backdrop = document.getElementById(backdropId);
  if (wrapper) wrapper.style.display = 'flex';
  if (modal) modal.style.display = 'block';
  if (backdrop) backdrop.style.display = 'block';
  modal?.focus();
}

function trapDialogKeyboard(event, modal, close) {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (modal.querySelector('button:disabled')) return;
    close();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) {
    event.preventDefault();
    modal.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

window.closeDuplicateActions = function () {
  const popup = document.getElementById('duplicate-actions-popup');
  if (popup) popup.remove();
  document.querySelectorAll('.duplicate-actions-trigger[aria-expanded="true"]').forEach(trigger => {
    trigger.setAttribute('aria-expanded', 'false');
  });
};

window.toggleDuplicateActions = function (event, trigger) {
  event.preventDefault();
  event.stopPropagation();
  const wasOpen = trigger.getAttribute('aria-expanded') === 'true';
  window.closeDuplicateActions();
  if (wasOpen) return;

  const recordId = trigger.dataset.recordId;
  const groupId = trigger.dataset.groupId;
  const isPrimary = trigger.dataset.primary === 'true';
  const popup = document.createElement('div');
  popup.id = 'duplicate-actions-popup';
  popup.className = 'duplicate-actions-options duplicate-actions-popup';
  popup.setAttribute('role', 'menu');
  popup.innerHTML = `
    <button type="button" class="duplicate-action-option" role="menuitem" data-action="SKIP">Skip</button>
    <button type="button" class="duplicate-action-option" role="menuitem" data-action="UPDATE">Update</button>
  `;
  popup.dataset.recordId = recordId;
  popup.dataset.groupId = groupId;
  popup.addEventListener('click', menuEvent => {
    const option = menuEvent.target.closest('[data-action]');
    if (!option) return;
    const action = option.dataset.action;
    const targetRecordId = popup.dataset.recordId;
    const targetGroupId = popup.dataset.groupId;
    window.closeDuplicateActions();
    if (action === 'UPDATE') {
      window.openEditDuplicateModal(targetRecordId, 'UPDATE');
    } else {
      window.resolveRecordAction(targetRecordId, action, targetGroupId);
    }
  });
  document.body.appendChild(popup);
  trigger.setAttribute('aria-expanded', 'true');

  const rect = trigger.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, rect.right - popupRect.width),
    window.innerWidth - popupRect.width - 8
  );
  const top = rect.bottom + popupRect.height <= window.innerHeight - 8
    ? rect.bottom + 4
    : Math.max(8, rect.top - popupRect.height - 4);
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.querySelector('[role="menuitem"]')?.focus();
};

window.pendingDuplicateResolution = null;
window.resolveRecordAction = async function (recordId, newAction, groupId) {
  if (!state.currentImportId || !recordId || !['SKIP', 'REJECT', 'UPDATE'].includes(newAction)) return;
  const record = findDuplicateRecord(recordId);
  if (!record) return;

  window.pendingDuplicateResolution = { recordId, groupId, action: newAction };
  if (newAction === 'UPDATE') {
    await window.openEditDuplicateModal(recordId, 'UPDATE');
    return;
  }

  const title = document.getElementById('resolution-modal-title');
  const description = document.getElementById('resolution-modal-description');
  const confirmButton = document.getElementById('btn-confirm-resolution');
  const reasonGroup = document.getElementById('resolution-reason-group');
  const reasonInput = document.getElementById('resolution-rejection-reason');
  const error = document.getElementById('resolution-modal-error');
  if (!title || !description || !confirmButton || !reasonGroup || !reasonInput) {
    restoreDuplicateAction(recordId);
    window.pendingDuplicateResolution = null;
    showToast('The resolution confirmation dialog is unavailable. Please refresh and try again.', 'error');
    return;
  }

  const rejecting = newAction === 'REJECT';
  title.textContent = rejecting ? 'Reject this record?' : 'Are you sure you want to skip this record?';
  description.textContent = rejecting
    ? 'This record will not be included in the final import.'
    : 'This record will be excluded from the final import.';
  confirmButton.textContent = rejecting ? 'Reject Record' : 'Skip Record';
  confirmButton.className = rejecting ? 'btn btn-danger' : 'btn btn-primary';
  reasonGroup.style.display = rejecting ? 'block' : 'none';
  reasonInput.value = '';
  if (error) {
    error.style.display = 'none';
    error.textContent = '';
  }
  setModalOpen('modal-resolution-wrapper', 'modal-resolution', 'modal-resolution-backdrop');
  document.getElementById('btn-cancel-resolution')?.focus();
};

window.closeResolutionModal = function () {
  const pending = window.pendingDuplicateResolution;
  ['modal-resolution', 'modal-resolution-wrapper', 'modal-resolution-backdrop'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
  });
  if (pending) restoreDuplicateAction(pending.recordId);
  window.pendingDuplicateResolution = null;
  document.getElementById(`duplicate-action-${pending?.recordId}`)?.focus();
};

async function confirmDuplicateResolution() {
  const pending = window.pendingDuplicateResolution;
  if (!pending || !state.currentImportId) return;
  const confirmButton = document.getElementById('btn-confirm-resolution');
  const cancelButton = document.getElementById('btn-cancel-resolution');
  const error = document.getElementById('resolution-modal-error');
  const rejectionReason = document.getElementById('resolution-rejection-reason')?.value.trim() || '';
  if (confirmButton) {
    confirmButton.disabled = true;
    confirmButton.textContent = pending.action === 'REJECT' ? 'Rejecting…' : 'Skipping…';
  }
  if (cancelButton) cancelButton.disabled = true;
  if (error) {
    error.style.display = 'none';
    error.textContent = '';
  }

  try {
    const summary = await apiRequest(`/${state.currentImportId}/resolve-duplicate-record`, {
      method: 'POST',
      body: JSON.stringify({
        recordId: pending.recordId,
        action: pending.action,
        rejectionReason: pending.action === 'REJECT' ? rejectionReason : undefined
      })
    });
    state.duplicateResult = summary;
    renderMatchingCounters(summary);
    renderDuplicateGroups([
      ...(summary.duplicateGroups || []),
      ...(summary.resolvedDuplicateGroups || [])
    ]);
    state.currentImport = await apiRequest(`/${state.currentImportId}`);
    await loadReviewSummary();
    window.closeResolutionModal();

    const remainingActiveGroups = (summary.duplicateGroups || []).filter(group => {
      if (group.isResolved || group.status === 'RESOLVED') return false;
      const k = String(group.matchKey || '').trim().toUpperCase();
      if (!k || k.includes('###') || k.includes('INVALID')) return false;
      return (group.records || []).some(r =>
        ['REVIEW', 'BLOCKED'].includes(String(r.resolutionAction || '').toUpperCase())
      );
    });

    if (remainingActiveGroups.length === 0) {
      showToast('All duplicates corrected! No duplicates left now.', 'success');
    } else {
      showToast(pending.action === 'REJECT' ? 'Record rejected successfully.' : 'Record skipped successfully. Excluded from final import dataset.', 'success');
    }
  } catch (err) {
    if (error) {
      error.textContent = `Could not resolve this record: ${err.message}`;
      error.style.display = 'block';
    } else {
      showToast('Failed to update record resolution: ' + err.message, 'error');
    }
    restoreDuplicateAction(pending.recordId);
  } finally {
    if (confirmButton) {
      confirmButton.disabled = false;
      confirmButton.textContent = pending.action === 'REJECT' ? 'Reject Record' : 'Skip Record';
    }
    if (cancelButton) cancelButton.disabled = false;
  }
}

function validateDuplicateEdit(values, fieldDefinitions) {
  const errors = {};
  for (const [field, value] of Object.entries(values)) {
    const definition = fieldDefinitions[field] || {};
    const text = typeof value === 'boolean' ? String(value) : String(value ?? '').trim();
    if (definition.readOnly || definition.immutable || definition.primaryKey) continue;
    if (definition.required && !text) {
      errors[field] = `${definition.label || field} is required.`;
      continue;
    }
    if (!text) continue;
    const type = String(definition.type || '').toUpperCase();
    if (['NUMBER', 'DECIMAL'].includes(type) && !Number.isFinite(Number(text))) {
      errors[field] = `${definition.label || field} must be a number.`;
    } else if (['DATE', 'DATETIME'].includes(type) && Number.isNaN(Date.parse(text))) {
      errors[field] = `${definition.label || field} must be a valid date.`;
    } else if (type === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      errors[field] = `${definition.label || field} must be a valid email address.`;
    } else if (type === 'BOOLEAN' && !['true', 'false', '1', '0', 'yes', 'no'].includes(text.toLowerCase())) {
      errors[field] = `${definition.label || field} must be true or false.`;
    } else if (type === 'ENUM' && Array.isArray(definition.enumValues) && !definition.enumValues.includes(text)) {
      errors[field] = `${definition.label || field} must be one of the listed options.`;
    }
    const constraints = definition.constraints || {};
    if (!errors[field] && Number.isFinite(Number(text)) && constraints.min !== undefined && Number(text) < constraints.min) {
      errors[field] = `${definition.label || field} must be at least ${constraints.min}.`;
    }
    if (!errors[field] && Number.isFinite(Number(text)) && constraints.max !== undefined && Number(text) > constraints.max) {
      errors[field] = `${definition.label || field} must be no more than ${constraints.max}.`;
    }
    if (!errors[field] && constraints.minLength !== undefined && text.length < constraints.minLength) {
      errors[field] = `${definition.label || field} must contain at least ${constraints.minLength} characters.`;
    }
    if (!errors[field] && constraints.maxLength !== undefined && text.length > constraints.maxLength) {
      errors[field] = `${definition.label || field} must contain no more than ${constraints.maxLength} characters.`;
    }
    if (!errors[field] && constraints.pattern) {
      try {
        if (!(new RegExp(constraints.pattern)).test(text)) errors[field] = `${definition.label || field} has an invalid format.`;
      } catch (error) {
        console.error(`Invalid validation pattern for field "${field}"`, error);
      }
    }
  }
  return errors;
}

function renderEditDuplicateFields(recordData, fieldDefinitions) {
  const fields = [...new Set([...Object.keys(fieldDefinitions), ...Object.keys(recordData)])]
    .filter(field => !field.startsWith('_'))
    .map(field => [field, recordData[field]]);
  return fields.map(([field, value]) => {
    const definition = fieldDefinitions[field] || {};
    const type = String(definition.type || '').toUpperCase();
    const isReadOnly = Boolean(definition.readOnly || definition.immutable || definition.primaryKey);
    const id = `edit-duplicate-field-${field}`;
    const valueString = value === null || value === undefined ? '' : String(value);
    let input;
    if (type === 'ENUM' && Array.isArray(definition.enumValues)) {
      const enumOptions = [...new Set([...definition.enumValues, ...(valueString && !definition.enumValues.includes(valueString) ? [valueString] : [])])];
      input = `<select id="${escapeHtml(id)}" class="select edit-dup-input" data-col="${escapeHtml(field)}" ${isReadOnly ? 'disabled' : ''}>
        <option value="">Select…</option>
        ${enumOptions.map(option => `<option value="${escapeHtml(option)}" ${option === valueString ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
      </select>`;
    } else if (type === 'BOOLEAN') {
      const checked = value === true || ['true', '1', 'yes'].includes(valueString.toLowerCase());
      input = `<input id="${escapeHtml(id)}" type="checkbox" class="edit-dup-input" data-col="${escapeHtml(field)}" data-control-type="BOOLEAN" ${checked ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}>`;
    } else {
      const inputType = ['NUMBER', 'DECIMAL'].includes(type) ? 'number'
        : type === 'DATE' ? 'date'
        : type === 'DATETIME' ? 'datetime-local'
        : 'text';
      const inputValue = inputType === 'date' ? valueString.slice(0, 10)
        : inputType === 'datetime-local' && valueString.includes('T') ? valueString.slice(0, 16)
        : valueString;
      input = `<input id="${escapeHtml(id)}" type="${inputType}" class="input input-sm edit-dup-input" data-col="${escapeHtml(field)}" data-control-type="${inputType}" value="${escapeHtml(inputValue)}" ${definition.required ? 'required' : ''} ${definition.constraints?.minLength !== undefined ? `minlength="${definition.constraints.minLength}"` : ''} ${definition.constraints?.maxLength !== undefined ? `maxlength="${definition.constraints.maxLength}"` : ''} ${definition.constraints?.min !== undefined ? `min="${definition.constraints.min}"` : ''} ${definition.constraints?.max !== undefined ? `max="${definition.constraints.max}"` : ''} ${isReadOnly ? 'readonly aria-readonly="true"' : ''}>`;
    }
    return `<div class="form-group mb-3">
      <label for="${escapeHtml(id)}" class="form-label" style="font-weight:600;">${escapeHtml(definition.label || field)}${definition.required ? ' <span aria-hidden="true">*</span>' : ''}${isReadOnly ? ' <span style="color:var(--text-muted);">(read-only)</span>' : ''}</label>
      ${input}
      <div class="edit-dup-field-error" data-error-for="${escapeHtml(field)}" role="alert" style="display:none; color:var(--danger); font-size:.8rem; margin-top:4px;"></div>
    </div>`;
  }).join('');
}

window.editPrimaryRecord = async function (recordId) {
  if (!state.currentImportId || !recordId) return;
  window.pendingDuplicateResolution = { recordId, action: 'EDIT' };
  await window.openEditDuplicateModal(recordId, 'EDIT');
};

window.openEditDuplicateModal = async function (recordId, action = 'UPDATE') {
  if (!state.currentImportId || !recordId) return;
  const record = findDuplicateRecord(recordId);
  const containingGroup = state.duplicateResult?.duplicateGroups?.find(group =>
    group.records?.some(item => item.recordId === recordId)
  );
  const modal = document.getElementById('modal-edit-duplicate-record');
  const body = document.getElementById('edit-dup-modal-body');
  const subtitle = document.getElementById('edit-dup-modal-subtitle');
  const modalTitle = document.getElementById('edit-dup-modal-title');
  const saveBtn = document.getElementById('btn-save-edit-duplicate');
  const backdrop = document.getElementById('modal-edit-dup-backdrop');
  if (!modal || !body || !backdrop || !document.getElementById('modal-edit-dup-wrapper')) {
    showToast('The record editor is unavailable. Please refresh and try again.', 'error');
    restoreDuplicateAction(recordId);
    window.pendingDuplicateResolution = null;
    return;
  }
  if (!record) {
    showToast('Could not find the selected record to edit. Run the duplicate scan again.', 'error');
    restoreDuplicateAction(recordId);
    window.pendingDuplicateResolution = null;
    return;
  }

  window.editingDuplicateRecordId = recordId;
  window.pendingDuplicateResolution = { recordId, groupId: containingGroup?.id, action };
  const isPrimary = Boolean(record.isPrimary || record.role === 'PRIMARY');
  const rowNum = record.sourceRowNumber || record.rowIndex || '?';
  if (modalTitle) modalTitle.textContent = 'Edit Record';
  if (saveBtn) saveBtn.textContent = isPrimary ? 'Save & Recheck' : 'Save & Update';
  if (subtitle) subtitle.textContent = `Review and update the record before applying the change. Source Row #${rowNum}`;
  const recordData = record.data || record.transformedData || record.rawData || {};
  const entity = state.entities.find(item => item.entity === state.currentImport?.targetEntity);
  const fieldDefinitions = entity?.fields || {};
  const referenceRecord = containingGroup?.records?.find(item => item.recordId !== recordId);
  const referenceData = referenceRecord?.data || containingGroup?.targetRecordData;
  const referenceRow = referenceRecord?.sourceRowNumber;
  const referenceRole = referenceRecord?.isPrimary || referenceRecord?.role === 'PRIMARY'
    ? 'PRIMARY RECORD'
    : referenceRecord ? 'DUPLICATE RECORD' : 'EXISTING RECORD';
  const referenceMarkup = referenceData
    ? `<section aria-label="Comparison record" style="padding:12px 14px;margin-bottom:16px;border:1px solid var(--border-color);border-left:4px solid var(--success, #10b981);border-radius:8px;background:var(--bg-surface);">
        <strong>${referenceRole} · READ ONLY${referenceRow ? ` · ROW ${escapeHtml(String(referenceRow))}` : ''}</strong>
        <div class="matching-record-data" style="margin-top:8px;overflow-wrap:anywhere;">${Object.entries(referenceData).filter(([field]) => !field.startsWith('_')).map(([field, value]) =>
          `<span class="matching-record-field"><strong>${escapeHtml(fieldDefinitions[field]?.label || field)}:</strong> <span>${escapeHtml(value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value))}</span></span>`
        ).join('<span class="matching-record-separator" aria-hidden="true">•</span>')}</div>
      </section>`
    : '';
  body.innerHTML = `${referenceMarkup}<strong style="display:block;margin-bottom:12px;">${isPrimary ? 'PRIMARY RECORD' : 'DUPLICATE RECORD'} · ROW ${escapeHtml(String(rowNum))}</strong>${renderEditDuplicateFields(recordData, fieldDefinitions) || '<div style="color:var(--text-muted); padding:16px;">No editable column values found for this record.</div>'}`;
  setModalOpen('modal-edit-dup-wrapper', 'modal-edit-duplicate-record', 'modal-edit-dup-backdrop');
  body.querySelector('.edit-dup-input:not([readonly]):not([disabled])')?.focus();

  if (saveBtn) saveBtn.onclick = async () => {
    const controls = [...body.querySelectorAll('.edit-dup-input')];
    body.querySelectorAll('.edit-dup-form-error').forEach(node => node.remove());
    const initialValues = Object.fromEntries(controls.map(control => {
      const field = control.dataset.col;
      const definition = fieldDefinitions[field] || {};
      const type = String(definition.type || '').toUpperCase();
      const sourceValue = recordData[field];
      const value = type === 'BOOLEAN'
        ? sourceValue === true || ['true', '1', 'yes'].includes(String(sourceValue ?? '').toLowerCase())
        : ['NUMBER', 'DECIMAL'].includes(type)
          ? (sourceValue === '' || sourceValue === null || sourceValue === undefined ? '' : Number(sourceValue))
          : type === 'DATE'
            ? String(sourceValue ?? '').slice(0, 10)
            : type === 'DATETIME' && String(sourceValue ?? '').includes('T')
              ? String(sourceValue).slice(0, 16)
              : String(sourceValue ?? '');
      return [field, value];
    }));
    const originalValues = { ...initialValues };
    const values = Object.fromEntries(controls.map(control => {
      const field = control.dataset.col;
      const definition = fieldDefinitions[field] || {};
      let value;
      if (control.dataset.controlType === 'BOOLEAN') value = control.checked;
      else if (['NUMBER', 'DECIMAL'].includes(String(definition.type || '').toUpperCase())) value = control.value === '' ? '' : Number(control.value);
      else value = control.value;
      return [field, value];
    }));
    const errors = validateDuplicateEdit(values, fieldDefinitions);
    body.querySelectorAll('.edit-dup-field-error').forEach(node => {
      node.textContent = errors[node.dataset.errorFor] || '';
      node.style.display = errors[node.dataset.errorFor] ? 'block' : 'none';
    });
    if (Object.keys(errors).length) {
      body.querySelector(`[data-col="${CSS.escape(Object.keys(errors)[0])}"]`)?.focus();
      return;
    }

    saveBtn.disabled = true;
    const cancelBtn = document.getElementById('btn-cancel-edit-duplicate');
    if (cancelBtn) cancelBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    const changedFields = Object.keys(values).filter(field =>
      !controls.find(control => control.dataset.col === field)?.readOnly &&
      !controls.find(control => control.dataset.col === field)?.disabled &&
      !fieldDefinitions[field]?.immutable &&
      !fieldDefinitions[field]?.primaryKey &&
      JSON.stringify(values[field]) !== JSON.stringify(initialValues[field])
    );
    const correctedFields = [];
    let finalCorrectionResult = null;
    try {
      if (changedFields.length > 0) {
        finalCorrectionResult = await apiRequest(`/${state.currentImportId}/records/${recordId}/correct`, {
          method: 'PATCH',
          body: JSON.stringify({
            fields: Object.fromEntries(changedFields.map(field => [field, values[field]]))
          })
        });
        correctedFields.push(...changedFields);
        Object.assign(record, {
          data: {
            ...(finalCorrectionResult.record?.transformedData ||
              finalCorrectionResult.record?.rawData ||
              record.data ||
              {})
          },
          status: finalCorrectionResult.record?.status || record.status
        });
      }

      const finalValidationErrors = (finalCorrectionResult?.record?.validationErrors || [])
        .filter(item => String(item.severity || 'ERROR').toUpperCase() === 'ERROR');
      if (finalValidationErrors.length) {
        const errorsByField = finalValidationErrors.reduce((collected, item) => {
          const targetField = item.field || changedFields[changedFields.length - 1];
          collected[targetField] = collected[targetField]
            ? `${collected[targetField]} ${item.message}`
            : item.message;
          return collected;
        }, {});
        for (const [invalidField, message] of Object.entries(errorsByField)) {
          const errorNode = body.querySelector(`[data-error-for="${CSS.escape(invalidField)}"]`);
          if (errorNode) {
            errorNode.textContent = message;
            errorNode.style.display = 'block';
          }
        }
        throw new Error('Please correct the highlighted fields before saving.');
      }

      const persistedAfterCorrection = await apiRequest(
        `/${state.currentImportId}/review/records/${encodeURIComponent(recordId)}`
      );
      Object.assign(record, {
        data: {
          ...(persistedAfterCorrection.transformedData ||
            persistedAfterCorrection.rawData ||
            record.data ||
            {})
        },
        status: persistedAfterCorrection.status,
        sourceRowNumber: persistedAfterCorrection.rowIndex
      });

      const rescannedSummary = await apiRequest(`/${state.currentImportId}/detect-duplicates`, {
        method: 'POST',
        body: JSON.stringify({ overrideStrategy: 'SEND_FOR_REVIEW' })
      });
      state.duplicateResult = rescannedSummary;
      renderMatchingCounters(rescannedSummary);
      renderDuplicateGroups([
        ...(rescannedSummary.duplicateGroups || []),
        ...(rescannedSummary.resolvedDuplicateGroups || [])
      ]);

      const resolutionAction = window.pendingDuplicateResolution?.action === 'EDIT' ? 'EDIT' : 'UPDATE';
      const summary = await apiRequest(`/${state.currentImportId}/resolve-duplicate-record`, {
        method: 'POST',
        body: JSON.stringify({ recordId, action: resolutionAction })
      });
      const persistedRecord = await apiRequest(
        `/${state.currentImportId}/review/records/${encodeURIComponent(recordId)}`
      );
      const persistedRecordData = persistedRecord.transformedData || persistedRecord.rawData || {};
      Object.assign(record, {
        data: { ...persistedRecordData },
        status: persistedRecord.status,
        sourceRowNumber: persistedRecord.rowIndex
      });
      for (const group of summary.duplicateGroups || []) {
        const updatedRecord = (group.records || []).find(item => item.recordId === recordId);
        if (updatedRecord) {
          updatedRecord.data = { ...persistedRecordData };
          updatedRecord.status = persistedRecord.status;
          updatedRecord.resolutionAction = persistedRecord.executionAction;
          updatedRecord.resolutionReason = persistedRecord.executionReason || persistedRecord.blockedReason || '';
          updatedRecord.sourceRowNumber = persistedRecord.rowIndex;
        }
      }
      const recordResolution = summary.recordResolution;
      const currentDuplicateGroups = summary.duplicateGroups || [];
      const remainsInDuplicateGroup = currentDuplicateGroups.some(group =>
        group.records?.some(item => item.recordId === recordId)
      );
      state.resolvedDuplicateRecords = (state.resolvedDuplicateRecords || []).filter(group =>
        !group.records?.some(item => item.recordId === recordId)
      );
      if (recordResolution?.resolved && !remainsInDuplicateGroup && containingGroup) {
        const resolvedRecord = {
          ...record,
          role: 'RESOLVED',
          isPrimary: false,
          data: { ...persistedRecordData },
          status: persistedRecord.status,
          resolutionAction: recordResolution.action,
          resolutionReason: persistedRecord.executionReason || 'Duplicate values updated; this record is now unique.',
          sourceRowNumber: persistedRecord.rowIndex
        };
        const resolvedGroupId = `resolved-${recordId}`;
        state.resolvedDuplicateRecords.push({
          ...containingGroup,
          id: resolvedGroupId,
          status: 'RESOLVED',
          isResolved: true,
          recordsCount: 1,
          records: [resolvedRecord]
        });
      }
      state.duplicateResult = summary;
      renderMatchingCounters(summary);
      window.closeEditDuplicateModal(true);
      renderDuplicateGroups([
        ...(summary.duplicateGroups || []),
        ...(summary.resolvedDuplicateGroups || [])
      ]);
      state.currentImport = await apiRequest(`/${state.currentImportId}`);
      await loadReviewSummary();
      const savedRecord = summary.duplicateGroups?.flatMap(group => group.records || []).find(item => item.recordId === recordId) ||
        persistedRecord;
      const updateResolved = summary.recordResolution?.recordId === recordId
        ? Boolean(summary.recordResolution.resolved)
        : String(savedRecord?.resolutionAction || '').toUpperCase() === 'UPDATE';

      const remainingActiveGroups = (summary.duplicateGroups || []).filter(group => {
        if (group.isResolved || group.status === 'RESOLVED') return false;
        const k = String(group.matchKey || '').trim().toUpperCase();
        if (!k || k.includes('###') || k.includes('INVALID')) return false;
        return (group.records || []).some(r =>
          ['REVIEW', 'BLOCKED'].includes(String(r.resolutionAction || '').toUpperCase())
        );
      });

      if (remainingActiveGroups.length === 0) {
        showToast('All duplicates corrected! No duplicates left now.', 'success');
      } else {
        showToast(
          updateResolved
            ? `Record #${rowNum} updated and cleared for import. It is now unique!`
            : `Record #${rowNum} remains unresolved: ${summary.recordResolution?.reason || savedRecord?.resolutionReason || 'correct the remaining validation or duplicate issue'}`,
          updateResolved ? 'success' : 'info'
        );
      }
    } catch (err) {
      if (correctedFields.length) {
        try {
          await apiRequest(`/${state.currentImportId}/records/${recordId}/correct`, {
            method: 'PATCH',
            body: JSON.stringify({
              fields: Object.fromEntries(correctedFields.map(field => [field, originalValues[field] ?? '']))
            })
          });
        } catch (rollbackError) {
          showToast(`Could not restore unsaved field changes: ${rollbackError.message}`, 'error');
        }
      }
      if (!body.querySelector('.edit-dup-field-error[style*="display: block"]')) {
        const messageNode = document.createElement('div');
        messageNode.className = 'edit-dup-form-error';
        messageNode.setAttribute('role', 'alert');
        messageNode.style.cssText = 'color:var(--danger); margin-bottom:12px;';
        messageNode.textContent = `Could not save the update: ${err.message}`;
        body.prepend(messageNode);
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = isPrimary ? 'Save & Recheck' : 'Save & Update';
      if (cancelBtn) cancelBtn.disabled = false;
    }
  };
};

window.closeEditDuplicateModal = function (resolved = false) {
  ['modal-edit-duplicate-record', 'modal-edit-dup-backdrop', 'modal-edit-dup-wrapper'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
  });
  const recordId = window.editingDuplicateRecordId;
  if (!resolved && recordId) restoreDuplicateAction(recordId);
  window.editingDuplicateRecordId = null;
  window.pendingDuplicateResolution = null;
  if (recordId) document.getElementById(`duplicate-action-${recordId}`)?.focus();
};

function renderDuplicateGroups(groupsOrSummary, resolvedGroupsArg) {
  const emptyState = document.getElementById('duplicate-empty-state');
  const container = document.getElementById('duplicate-findings-container');
  const groupsList = document.getElementById('duplicate-groups-list');
  const badge = document.getElementById('duplicate-findings-count-badge');
  const resolvedSection = document.getElementById('duplicate-resolved-section');
  const resolvedList = document.getElementById('duplicate-resolved-list');
  const resolvedBadge = document.getElementById('duplicate-resolved-count-badge');
  if (!container || !groupsList) return;

  let currentGroups = [];
  let resolvedGroups = [];

  if (groupsOrSummary && !Array.isArray(groupsOrSummary) && typeof groupsOrSummary === 'object') {
    currentGroups = (groupsOrSummary.duplicateGroups || []).filter(g =>
      !g.isResolved && g.status !== 'RESOLVED'
    );
    resolvedGroups = groupsOrSummary.resolvedDuplicateGroups || [];
  } else if (Array.isArray(groupsOrSummary)) {
    currentGroups = groupsOrSummary.filter(g => !g.isResolved && g.status !== 'RESOLVED');
    resolvedGroups = resolvedGroupsArg || state.duplicateResult?.resolvedDuplicateGroups || groupsOrSummary.filter(g => g.isResolved || g.status === 'RESOLVED');
  }

  // Filter active groups to only those with genuine unresolved review items
  currentGroups = currentGroups.filter(g => {
    const k = String(g.matchKey || '').trim().toUpperCase();
    if (!k || k.includes('###') || k.includes('INVALID')) return false;
    return (g.records || []).some(record =>
      ['REVIEW', 'BLOCKED'].includes(String(record.resolutionAction || '').toUpperCase())
    );
  });

  if (badge) {
    badge.textContent = `${currentGroups.length} DUPLICATE GROUPS`;
  }

  if (emptyState) emptyState.style.display = 'none';
  container.style.display = 'block';

  if (currentGroups.length === 0) {
    groupsList.innerHTML = `
      <div class="card duplicate-all-resolved-card" style="padding: 32px; text-align: center; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 8px;">
        <div style="font-size: 2.5rem; margin-bottom: 8px; color: #10b981;">✓</div>
        <h4 style="margin: 0 0 6px 0; font-size: 1.15rem; font-weight: 700; color: #10b981;">All Duplicates Corrected — No Duplicates Left!</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-main);">
          Every record in your dataset is now unique. No records require duplicate review.
        </p>
      </div>
    `;
  } else {
    const entityFields = state.entities.find(item => item.entity === state.currentImport?.targetEntity)?.fields || {};
    groupsList.innerHTML = currentGroups.map((group, idx) => {
      const recordsList = group.records || [];
      const recordsCount = recordsList.length;
      const primaryRecord = recordsList.find(record => record.isPrimary || record.role === 'PRIMARY');
      const primaryData = primaryRecord?.data || {};
      const fieldKeys = [...new Set([
        ...Object.keys(entityFields),
        ...recordsList.flatMap(record => Object.keys(record.data || {}))
      ])].filter(field => !field.startsWith('_') && recordsList.some(record =>
        Object.prototype.hasOwnProperty.call(record.data || {}, field)
      ));
      const differingFieldKeys = new Set(primaryRecord && recordsList.length > 1
        ? recordsList
            .filter(record => record !== primaryRecord)
            .flatMap(record => fieldKeys.filter(field =>
              JSON.stringify(record.data?.[field] ?? null) !== JSON.stringify(primaryData[field] ?? null)
            ))
        : []);
      const tableHeaders = fieldKeys.map(field =>
        `<th scope="col">${escapeHtml(entityFields[field]?.label || field)}</th>`
      ).join('');
      const recordsMarkup = recordsList.map((rec) => {
        const isPrimary = rec.isPrimary || rec.role === 'PRIMARY';
        const actionsMarkup = `<button
          type="button"
          class="duplicate-actions-trigger"
          aria-haspopup="menu"
          aria-expanded="false"
          aria-label="Actions for ${isPrimary ? 'primary' : 'duplicate'} source row ${escapeHtml(String(rec.sourceRowNumber))}"
          data-record-id="${escapeHtml(rec.recordId)}"
          data-group-id="${escapeHtml(group.id)}"
          data-primary="${isPrimary}"
          onclick="window.toggleDuplicateActions(event, this)">Actions <span aria-hidden="true">▾</span></button>`;
        const duplicateNumber = recordsList
          .filter(item => !(item.isPrimary || item.role === 'PRIMARY'))
          .findIndex(item => item.recordId === rec.recordId) + 1;
        const recordRole = isPrimary ? 'PRIMARY RECORD' : `DUPLICATE RECORD ${duplicateNumber}`;
        const fieldCells = fieldKeys.map(field => {
          const value = rec.data?.[field];
          const displayValue = value === null || value === undefined
            ? '—'
            : typeof value === 'object' ? JSON.stringify(value) : String(value);
          const differs = differingFieldKeys.has(field);
          return `<td class="duplicate-table-value${differs ? ' is-different' : ''}">${escapeHtml(displayValue)}</td>`;
        }).join('');
        return `<tr class="duplicate-table-row${isPrimary ? ' is-primary' : ''}">
          <th scope="row" class="duplicate-table-role">${escapeHtml(recordRole)}</th>
          <td class="duplicate-table-source">Row ${escapeHtml(String(rec.sourceRowNumber))}</td>
          ${fieldCells}
          <td class="duplicate-table-actions">${actionsMarkup}</td>
        </tr>`;
      }).join('');

      return `
        <section class="card duplicate-group-card mb-3 expanded" id="duplicate-group-${group.id}">
          <div class="duplicate-group-header">
            <div class="duplicate-group-title">
              <strong>Duplicate Found · Group ${group.groupIndex || (idx + 1)}</strong>
              <span class="group-count-pill">${recordsCount} ${recordsCount === 1 ? 'record' : 'records'}</span>
            </div>
          </div>
          <div class="duplicate-group-body" id="group-body-${group.id}">
            <div class="duplicate-table-scroll">
              <table class="duplicate-review-table">
                <thead><tr>
                  <th scope="col">Record</th>
                  <th scope="col">Source Row</th>
                  ${tableHeaders}
                  <th scope="col">Actions</th>
                </tr></thead>
                <tbody>${recordsMarkup}</tbody>
              </table>
            </div>
          </div>
        </section>
      `;
    }).join('');
  }

  // Render Resolved Records Section
  if (resolvedSection && resolvedList) {
    if (resolvedGroups.length === 0) {
      resolvedSection.style.display = 'none';
      resolvedList.innerHTML = '';
      if (resolvedBadge) resolvedBadge.textContent = '0 Resolved';
    } else {
      resolvedSection.style.display = 'block';
      if (resolvedBadge) resolvedBadge.textContent = `${resolvedGroups.length} Resolved`;
      resolvedList.innerHTML = resolvedGroups.map((group) => {
        const record = group.records?.[0] || {};
        const isSkipped = record.role === 'SKIPPED' ||
          String(record.resolutionAction || '').toUpperCase() === 'SKIP';
        const actionLabel = isSkipped ? 'SKIPPED' : 'UPDATED';
        const badgeClass = isSkipped ? 'badge-secondary' : 'badge-success';
        const rowNum = record.sourceRowNumber || group.sourceRowNumbers?.[0] || '?';
        const reason = record.resolutionReason || group.resolutionReason || (isSkipped ? 'Excluded from final import dataset' : 'Duplicate values updated; record is now unique');
        const recordData = record.data || {};
        const dataEntries = Object.entries(recordData).filter(([k]) => !k.startsWith('_'));
        const dataMarkup = dataEntries.map(([k, v]) => {
          const valStr = v === null || v === undefined ? '—' : String(v);
          return `<span class="matching-record-field" style="margin-right:12px; font-size:0.85rem;"><strong>${escapeHtml(k)}:</strong> <span style="color:var(--text-muted);">${escapeHtml(valStr)}</span></span>`;
        }).join('');

        return `
          <div class="card mb-2" style="padding: 12px 16px; border-left: 4px solid ${isSkipped ? '#64748b' : '#10b981'}; background: var(--bg-surface);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="badge ${badgeClass}" style="font-weight:700;">${actionLabel}</span>
                <strong style="font-size:0.95rem;">Source Row #${escapeHtml(String(rowNum))}</strong>
                <span style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(reason)}</span>
              </div>
            </div>
            ${dataMarkup ? `<div style="margin-top:8px; overflow-wrap:anywhere; border-top:1px solid rgba(148,163,184,0.15); padding-top:6px;">${dataMarkup}</div>` : ''}
          </div>
        `;
      }).join('');
    }
  }
}

// -----------------------------------------------------------------------------
// STEP 6: REVIEW & GOVERNANCE
// -----------------------------------------------------------------------------
function setApprovalStepVisible(visible) {
  const approvalNode = document.getElementById('step-node-7');
  const reviewApprovalConnector = document.getElementById('step-line-6');
  if (approvalNode) approvalNode.style.display = visible ? '' : 'none';
  if (reviewApprovalConnector) reviewApprovalConnector.style.display = visible ? '' : 'none';
}

async function loadReviewSummary() {
  if (!state.currentImportId) return;
  try {
    const review = await apiRequest(`/${state.currentImportId}/review`);
    state.reviewSummary = review;

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value === null || value === undefined ? '—' : String(value);
    };
    setText('review-import-name', review.importName);
    setText('review-import-department', review.department);
    setText('review-import-file', review.fileName);
    setText('review-import-total', Number(review.totalRecords ?? 0).toLocaleString());
    setText('review-impact-insert', review.plannedCreates);
    setText('review-impact-update', review.plannedUpdates);
    setText('review-impact-skip', review.plannedSkips);
    setText('review-impact-reject', review.plannedRejected);
    setText('review-impact-failed', review.plannedFailed);

    const readinessStatus = document.getElementById('review-readiness-status');
    if (readinessStatus) {
      readinessStatus.textContent = review.readinessLabel || 'ACTION REQUIRED';
      readinessStatus.className = `review-readiness-status ${review.readiness === 'READY' ? 'is-ready' : 'is-blocked'}`;
    }
    const reviewItems = document.getElementById('review-items-needing-review');
    if (reviewItems) {
      const count = Number(review.itemsNeedingReview || 0);
      if (count === 0 && review.readiness === 'READY') {
        reviewItems.textContent = '✓ All records are ready for import';
      } else if (count > 0) {
        const reasons = [
          review.unresolvedValidationErrors
            ? `${review.unresolvedValidationErrors} validation errors`
            : '',
          review.unresolvedDuplicates
            ? `${review.unresolvedDuplicates} unresolved duplicates`
            : '',
          review.unresolvedBlockingIssues
            ? `${review.unresolvedBlockingIssues} other blocking issues`
            : ''
        ].filter(Boolean).join(', ');
        reviewItems.textContent = `${count} ${count === 1 ? 'record still requires' : 'records still require'} action${reasons ? `: ${reasons}` : ''}`;
      } else {
        reviewItems.textContent = (review.blockingIssues || []).join('; ') || 'Complete the remaining review checks.';
      }
    }
    const viewIssuesButton = document.getElementById('btn-review-view-issues');
    if (viewIssuesButton) viewIssuesButton.style.display = review.readiness === 'READY' ? 'none' : '';

    const checklist = document.getElementById('review-checklist-items');
    if (checklist) {
      checklist.innerHTML = (review.checklist || []).map(item => {
        const passed = Boolean(item.passed);
        return `<li class="check-item ${passed ? 'passed' : 'failed'}">
          <span class="check-icon">${passed ? '✓' : '✕'}</span>
          <span><strong>${escapeHtml(item.title || item.code)}</strong><small>${escapeHtml(item.message || '')}</small></span>
        </li>`;
      }).join('') || '<li class="check-item failed"><span class="check-icon">✕</span><span>No server-side checklist was returned.</span></li>';
    }

    const approvalRequired = Boolean(review.requiresApproval);
    setApprovalStepVisible(approvalRequired);
    const approvalSatisfied = review.approvalStatus === 'APPROVED';
    const nextApprovalButton = document.getElementById('btn-step7-next');
    if (nextApprovalButton) {
      nextApprovalButton.disabled = !hasPermission('DATA_IMPORT_EXECUTE') || (approvalRequired && !approvalSatisfied);
    }
    const reviewNextButton = document.getElementById('btn-step6-next');
    if (reviewNextButton) {
      const label = approvalRequired && !approvalSatisfied
        ? 'Continue to Approval'
        : 'Continue';
      reviewNextButton.innerHTML = `${label} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      reviewNextButton.disabled = review.readiness !== 'READY';
    }

    const bannerTitle = document.getElementById('approval-banner-title');
    const bannerSub = document.getElementById('approval-banner-sub');
    if (bannerTitle && bannerSub) {
      if (!approvalRequired) {
        bannerTitle.textContent = 'Approval Not Required';
        bannerSub.textContent = 'This import satisfies the configured policy without an approval gate.';
      } else if (approvalSatisfied) {
        bannerTitle.textContent = 'Job Approved & Authorized';
        bannerSub.textContent = `Signed off by ${review.approvalDetails?.approvedBy || 'authorized approver'}`;
      } else if (review.approvalStatus === 'PENDING') {
        bannerTitle.textContent = 'Approval request submitted';
        bannerSub.textContent = `Assigned to ${review.approverLabel || review.assignedApproverRole || 'the configured business approver'}.`;
      } else {
        bannerTitle.textContent = 'Ready to request approval';
        bannerSub.textContent = `Approval is required under the configured policy. The request will be sent to ${review.approverLabel || 'the assigned business role'}.`;
      }
    }

    const actionRow = document.querySelector('.approval-actions-row');
    const canDecide = hasPermission('DATA_IMPORT_APPROVE') &&
      review.approvalStatus === 'PENDING' &&
      Boolean(review.assignedApproverRole) &&
      String(state.userContext.role || '').toLowerCase().replaceAll('-', '_') === String(review.assignedApproverRole).toLowerCase().replaceAll('-', '_') &&
      review.submittedBy !== state.userContext.userId;
    if (actionRow) actionRow.style.display = canDecide ? '' : 'none';
    const approverNotice = document.getElementById('approval-permission-notice');
    if (approverNotice && review.approvalStatus === 'PENDING' && !canDecide) {
      approverNotice.style.display = '';
      approverNotice.textContent = `Awaiting a decision from ${review.approverLabel || review.assignedApproverRole || 'the assigned approver'}.`;
    }
    applyRoleAwareUi();
  } catch (err) {
    showToast('Failed to load review summary: ' + err.message, 'error');
  }
}

function setupReviewEvents() {
  document.getElementById('btn-step6-back')?.addEventListener('click', () => { if (document.getElementById('btn-step6-back')?.dataset.draftAware === 'true') return; goToWizardStep(5); });
  document.getElementById('btn-review-view-issues')?.addEventListener('click', () => {
    const review = state.reviewSummary;
    const firstFailedCheck = review?.checklist?.find(item => !item.passed)?.code;
    const targetStep = firstFailedCheck === 'FILE_PARSED' ? 2
      : ['MAPPING_CONFIGURED', 'REQUIRED_FIELDS_MAPPED'].includes(firstFailedCheck) ? 3
        : firstFailedCheck === 'VALIDATION_COMPLETED' ? 4
          : 5;
    goToWizardStep(targetStep, true);
  });
  document.getElementById('btn-step6-next')?.addEventListener('click', async () => {
    const review = state.reviewSummary;
    if (!review || review.readiness !== 'READY') return;
    if (!review.requiresApproval || review.approvalStatus === 'APPROVED') {
      goToWizardStep(8);
      return;
    }
    if (review.approvalStatus === 'PENDING') {
      goToWizardStep(7);
      return;
    }
    if (!hasPermission('DATA_IMPORT_CREATE')) return;
    const button = document.getElementById('btn-step6-next');
    if (button) button.disabled = true;
    try {
      await apiRequest(`/${state.currentImportId}/submit-approval`, { method: 'POST' });
      state.currentImport = await apiRequest(`/${state.currentImportId}`);
      await loadReviewSummary();
      await refreshWorkflowStats();
      goToWizardStep(7);
      showToast('Approval request submitted to the configured business role.', 'success');
    } catch (err) {
      showToast('Could not submit approval request: ' + err.message, 'error');
    } finally {
      if (button) button.disabled = state.reviewSummary?.readiness !== 'READY';
    }
  });
}

// -----------------------------------------------------------------------------
// STEP 7: APPROVAL & FOUR-EYES GOVERNANCE
// -----------------------------------------------------------------------------
function setupApprovalEvents() {
  document.getElementById('btn-step7-back')?.addEventListener('click', () => { if (document.getElementById('btn-step7-back')?.dataset.draftAware === 'true') return; goToWizardStep(6); });

  document.getElementById('btn-approve-import')?.addEventListener('click', async () => {
    if (!state.currentImportId) return;
    const notes = document.getElementById('input-approval-notes').value.trim();

    try {
      await apiRequest(`/${state.currentImportId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ comment: notes || 'Verified and approved for release' })
      });
      state.currentImport = await apiRequest(`/${state.currentImportId}`);
      await loadReviewSummary();
      await refreshWorkflowStats();
      showToast('Import job successfully approved!', 'success');
    } catch (err) {
      showToast('Approval rejected: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-reject-import')?.addEventListener('click', async () => {
    if (!state.currentImportId) return;
    const notes = document.getElementById('input-approval-notes').value.trim();
    if (!notes) {
      showToast('Please provide a reason for rejecting the import', 'error');
      return;
    }

    try {
      await apiRequest(`/${state.currentImportId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: notes })
      });
      state.currentImport = await apiRequest(`/${state.currentImportId}`);
      await loadReviewSummary();
      showToast('Import job rejected.', 'warning');
      switchView('dashboard');
    } catch (err) {
      showToast('Rejection failed: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-step7-next')?.addEventListener('click', () => goToWizardStep(8));
}

// -----------------------------------------------------------------------------
// STEP 8: EXECUTION & COMMIT
// -----------------------------------------------------------------------------
function renderExecutionMetrics(execution = null) {
  const snapshot = state.workflowStats || {};
  const rows = snapshot.rows || {};
  const planned = snapshot.planned || {};
  const total = Number(execution?.totalRecords ?? rows.total ?? 0);
  const committed = Number(execution ? (execution.successfulCreates || 0) + (execution.successfulUpdates || 0) : (rows.inserted || 0) + (rows.updated || 0));
  const failed = Number(execution?.failedRecords ?? rows.failed ?? 0);
  const skipped = Number(execution?.skippedRecords ?? rows.skipped ?? 0);
  const rejected = Number(execution?.rejectedRecords ?? rows.rejected ?? 0);
  const blocked = Number(execution?.blockedRecords ?? rows.blocked ?? 0);
  const processed = Number(execution ? committed + failed + skipped + rejected + blocked : rows.processed ?? 0);
  const remaining = Math.max(total - processed, 0);
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value === null || value === undefined ? '—' : Number(value).toLocaleString(); };
  set('exec-stat-total', total);
  set('exec-stat-columns', snapshot.columns ?? 0);
  set('exec-stat-ready', Math.max(total - Number(rows.invalid || 0), 0));
  set('exec-stat-planned-inserts', planned.inserts ?? rows.inserted ?? 0);
  set('exec-stat-planned-updates', planned.updates ?? rows.updated ?? 0);
  set('exec-stat-planned-skips', planned.skips ?? rows.skipped ?? 0);
  set('exec-metric-total', total);
  set('exec-metric-processed', processed);
  set('exec-metric-success', committed);
  set('exec-metric-skipped', skipped);
  set('exec-metric-rejected', rejected);
  set('exec-metric-blocked', blocked);
  set('exec-metric-remaining', remaining);
  set('exec-metric-failed', failed);
  const duration = execution?.durationMs;
  const durationEl = document.getElementById('exec-metric-duration');
  if (durationEl) durationEl.textContent = duration === undefined || duration === null ? '—' : `${Number(duration).toLocaleString()} ms`;
  return { total, committed, failed, skipped, rejected, blocked, processed, remaining };
}

function syncExecutionUi() {
  const button = document.getElementById('btn-trigger-execution');
  if (!button) return;
  const status = state.currentImport?.status;
  const approvalRequired = Boolean(state.reviewSummary?.requiresApproval);
  const approved = status === 'APPROVED' || state.reviewSummary?.approvalStatus === 'APPROVED';
  const noApprovalGate = state.reviewSummary && !approvalRequired;
  const allowed = ['APPROVED', 'QUEUED', 'PROCESSING'].includes(status) || noApprovalGate;
  button.disabled = !allowed || (approvalRequired && !approved);
  button.title = button.disabled ? 'Execution becomes available only after the required approval/review gate is satisfied.' : 'Start the real transactional batch execution.';
  renderExecutionMetrics();
}

async function pollExecutionStatus() {
  if (!state.currentImportId) return null;
  try {
    const execution = await apiRequest(`/${state.currentImportId}/execution`);
    const total = Number(execution.totalRecords || state.workflowStats?.rows?.total || 0);
    const done = Number(execution.successfulCreates || 0) + Number(execution.successfulUpdates || 0) + Number(execution.skippedRecords || 0) + Number(execution.rejectedRecords || 0) + Number(execution.blockedRecords || 0) + Number(execution.failedRecords || 0);
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const fill = document.getElementById('exec-progress-fill');
    const label = document.getElementById('exec-percent-text');
    const statusText = document.getElementById('exec-status-text');
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `${pct}%`;
    if (statusText) statusText.textContent = execution.status === 'IN_PROGRESS' ? `Processing ${done.toLocaleString()} of ${total.toLocaleString()} records...` : `Execution ${String(execution.status || '').toLowerCase().replaceAll('_', ' ')}.`;
    renderExecutionMetrics(execution);
    return execution;
  } catch (_) {
    return null;
  }
}

function setupExecutionEvents() {
  document.getElementById('btn-step8-back')?.addEventListener('click', () => {
    if (document.getElementById('btn-step8-back')?.dataset.draftAware === 'true') return;
    goToWizardStep(state.reviewSummary?.requiresApproval ? 7 : 6);
  });

  document.getElementById('btn-trigger-execution')?.addEventListener('click', async () => {
    if (!state.currentImportId) return;
    const triggerBtn = document.getElementById('btn-trigger-execution');
    if (!triggerBtn || triggerBtn.disabled) return;

    const progressWrapper = document.getElementById('exec-progress-wrapper');
    const progressFill = document.getElementById('exec-progress-fill');
    const progressPercent = document.getElementById('exec-percent-text');
    const consoleBox = document.getElementById('exec-console-box');
    let pollTimer = null;

    try {
      triggerBtn.disabled = true;
      if (progressWrapper) progressWrapper.style.display = 'block';
      if (progressFill) progressFill.style.width = '0%';
      if (progressPercent) progressPercent.textContent = '0%';
      const statusText = document.getElementById('exec-status-text');
      if (statusText) statusText.textContent = 'Execution started — processing real records...';
      if (consoleBox) consoleBox.innerHTML += `<div class="console-line">[START] Executing import batch in transactional chunks...</div>`;

      pollTimer = window.setInterval(() => { pollExecutionStatus(); }, 500);
      const execRes = await apiRequest(`/${state.currentImportId}/execute`, { method: 'POST' });
      if (pollTimer) window.clearInterval(pollTimer);
      state.executionResult = execRes;

      const executionJob = await apiRequest(`/${state.currentImportId}`);
      state.currentImport = executionJob;
      await refreshWorkflowStats();
      renderExecutionMetrics(execRes);

      const total = Number(execRes.totalRecords || state.workflowStats?.rows?.total || 0);
      if (progressFill) progressFill.style.width = '100%';
      if (progressPercent) progressPercent.textContent = '100%';
      if (statusText) statusText.textContent = `Execution completed — ${total.toLocaleString()} records reconciled through the execution engine.`;

      const committed = Number(execRes.successfulCreates || 0) + Number(execRes.successfulUpdates || 0);
      const failed = Number(execRes.failedRecords || 0);
      if (consoleBox) consoleBox.innerHTML += `<div class="console-line text-green">[SUCCESS] Batch executed: ${committed.toLocaleString()} committed, ${failed.toLocaleString()} failed.</div>`;
      document.getElementById('btn-step8-next').disabled = false;
      showToast('Transactional execution completed successfully!', 'success');
    } catch (err) {
      if (pollTimer) window.clearInterval(pollTimer);
      // Refresh the authoritative job state after a failed start. In particular,
      // a preflight/provider error must not leave the UI showing stale VALIDATED
      // state together with a fake in-progress console.
      try {
        const latestJob = await apiRequest(`/${state.currentImportId}`);
        state.currentImport = latestJob;
        await refreshWorkflowStats();
      } catch (_) {
        // Preserve the original execution error if the refresh itself fails.
      }
      const latest = await pollExecutionStatus();
      if (consoleBox) consoleBox.innerHTML += `<div class="console-line text-red">[ERROR] ${escapeHtml(err.message || 'Execution failed')}</div>`;
      triggerBtn.disabled = false;
      syncExecutionUi();
      showToast('Execution failed: ' + err.message, 'error');
      return latest;
    }
  });

  document.getElementById('btn-step8-next')?.addEventListener('click', async () => {
    // Trigger Reconciliation for Step 9
    await runReconciliation();
    goToWizardStep(9);
  });
}

// -----------------------------------------------------------------------------
// STEP 9: POST-IMPORT RECONCILIATION
// -----------------------------------------------------------------------------
async function runReconciliation() {
  if (!state.currentImportId) return;
  try {
    const recon = await apiRequest(`/${state.currentImportId}/reconcile`, { method: 'POST' });
    state.reconciliationResult = recon;

    // Reconciliation APIs may legitimately return only execution-specific
    // counters. Fill the source/quality counters from the same authoritative
    // workflow snapshot used by the rest of the wizard so the page never shows
    // misleading em-dashes when the values are already known.
    const snapshot = state.workflowStats || {};
    const rows = snapshot.rows || {};
    const sourceRows = Number(recon.sourceRows ?? recon.plannedRecords ?? rows.total ?? state.currentImport?.totalRecords ?? 0);
    const sourceColumns = Number(recon.sourceColumns ?? snapshot.columns ?? state.currentImport?.fileMetadata?.columnCount ?? 0);
    const validatedRows = Number(recon.validatedRows ?? rows.valid ?? state.currentImport?.validRecords ?? 0);
    const warningRows = Number(recon.warningRows ?? rows.warnings ?? state.currentImport?.warningRecords ?? 0);
    const invalidRows = Number(recon.invalidRows ?? rows.invalid ?? state.currentImport?.invalidRecords ?? 0);
    const correctedRows = Number(recon.correctedRows ?? rows.corrected ?? 0);
    const duplicateRows = Number(recon.duplicateRows ?? rows.duplicates ?? 0);
    const createdRecords = Number(recon.createdRecords ?? rows.inserted ?? 0);
    const updatedRecords = Number(recon.updatedRecords ?? rows.updated ?? 0);
    const skippedRecords = Number(recon.skippedRecords ?? rows.skipped ?? 0);
    const rejectedRecords = Number(recon.rejectedRecords ?? rows.rejected ?? 0);
    const blockedRecords = Number(recon.blockedRecords ?? rows.blocked ?? 0);
    const failedRecords = Number(recon.failedRecords ?? rows.failed ?? 0);
    const accountedRows = Number(recon.createdRecords ?? 0) + Number(recon.updatedRecords ?? 0) +
      Number(recon.skippedRecords ?? 0) + rejectedRecords + blockedRecords + failedRecords;

    const values = {
      'recon-source-rows': sourceRows,
      'recon-source-columns': sourceColumns,
      'recon-validated-rows': validatedRows,
      'recon-warning-rows': warningRows,
      'recon-invalid-rows': invalidRows,
      'recon-corrected-rows': correctedRows,
      'recon-duplicate-rows': duplicateRows,
      'recon-accounted-rows': accountedRows,
      'recon-target-created': createdRecords,
      'recon-target-updated': updatedRecords,
      'recon-target-skipped': skippedRecords,
      'recon-target-rejected': rejectedRecords,
      'recon-target-blocked': blockedRecords,
      'recon-target-failed': failedRecords,
      'recon-source-rows-table': sourceRows,
      'recon-created-table': createdRecords,
      'recon-updated-table': updatedRecords,
      'recon-skipped-table': skippedRecords,
      'recon-blocked-table': blockedRecords,
      'recon-failed-table': failedRecords
    };
    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Number(value).toLocaleString();
    });

    const badge = document.getElementById('recon-status-badge');
    badge.textContent = recon.status || 'RECONCILIATION_PENDING';
    badge.className = recon.status === 'FULLY_RECONCILED' ? 'recon-badge fully-reconciled' : 'recon-badge badge-warning';

    const variance = Number(recon.varianceCount ?? Math.abs(sourceRows - accountedRows));
    const variancePct = sourceRows > 0 ? ((variance / sourceRows) * 100).toFixed(2) : '0.00';
    document.getElementById('recon-variance-tag').textContent = `Unaccounted rows: ${variance.toLocaleString()} (${variancePct}%)`;
    const varianceDetail = document.getElementById('recon-variance-detail');
    if (varianceDetail) {
      const affectedRows = Array.isArray(recon.mismatches) ? recon.mismatches : [];
      const rowSummary = affectedRows.length
        ? `<ul>${affectedRows.map(item => `<li>Row #${Number(item.rowIndex).toLocaleString()}: ${escapeHtml('This row needs review because its final outcome could not be confirmed.')}</li>`).join('')}</ul>`
        : '';
      const varianceSummary = variance === 0
        ? `${accountedRows.toLocaleString()} of ${sourceRows.toLocaleString()} source rows have a recorded outcome.`
        : `${accountedRows.toLocaleString()} of ${sourceRows.toLocaleString()} source rows have a recorded outcome. Review the import history for any source rows without a recorded outcome.`;
      varianceDetail.innerHTML = `${escapeHtml(varianceSummary)}${rowSummary}`;
    }
    const failedBadge = document.getElementById('recon-failed-badge');
    if (failedBadge) failedBadge.innerHTML = `<span class="badge ${recon.failedRecords ? 'badge-danger' : 'badge-success'}">${Number(recon.failedRecords || 0).toLocaleString()} Errors</span>`;
  } catch (err) {
    showToast('Reconciliation failed: ' + err.message, 'error');
  }
}

function setupReconciliationEvents() {
  document.getElementById('btn-step9-back')?.addEventListener('click', () => { if (document.getElementById('btn-step9-back')?.dataset.draftAware === 'true') return; goToWizardStep(8); });
  document.getElementById('btn-step9-next')?.addEventListener('click', async () => {
    await loadFinalReport();
    goToWizardStep(10);
  });
}

// -----------------------------------------------------------------------------
// STEP 10: FINAL REPORT & EXPORT
// -----------------------------------------------------------------------------
async function loadFinalReport() {
  if (!state.currentImportId) return;
  try {
    const report = await apiRequest(`/${state.currentImportId}/report`);
    const processing = report.processing || {};
    const matching = report.matching || {};
    const execution = report.execution || {};
    const reconciliation = report.reconciliation || {};

    document.getElementById('report-job-title').textContent = report.importInfo?.name || 'Import Job Complete';
    const duration = Number(report.importInfo?.durationMs || 0);
    document.getElementById('report-meta-text').textContent = `Completed ${formatDate(report.importInfo?.completedAt || new Date())} · ${report.importInfo?.targetEntity || 'Import'} · ${duration.toLocaleString()} ms`;
    const statusBadge = document.getElementById('report-status-badge');
    if (statusBadge) {
      statusBadge.textContent = report.importInfo?.status || 'COMPLETED';
      statusBadge.className = `badge btn-lg ${['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(report.importInfo?.status) ? 'badge-success' : 'badge-warning'}`;
    }

    const values = {
      'report-total-rows': processing.totalRows ?? 0,
      'report-column-count': processing.columnCount ?? 0,
      'report-valid-rows': processing.validRows ?? 0,
      'report-warning-rows': processing.warningRows ?? 0,
      'report-invalid-rows': processing.invalidRows ?? 0,
      'report-corrected-rows': processing.correctedRows ?? 0,
      'report-duplicate-rows': matching.duplicateRows ?? matching.duplicateInFile ?? 0,
      'report-created': execution.created ?? 0,
      'report-updated': execution.updated ?? 0,
      'report-skipped': execution.skipped ?? 0,
      'report-rejected': execution.rejected ?? 0,
      'report-blocked': execution.blocked ?? 0,
      'report-failed': execution.failed ?? 0,
      'report-variance': reconciliation.varianceCount ?? 0
    };
    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Number(value).toLocaleString();
    });
    const approvalSummary = document.getElementById('report-approval-summary');
    if (approvalSummary) {
      const approval = report.approval || {};
      const decided = approval.status === 'NOT_REQUIRED'
        ? 'No approval was required for this import.'
        : approval.decidedBy
        ? `Decided by ${escapeHtml(approval.decidedBy)}${approval.decidedByRole ? ` (${escapeHtml(approval.decidedByRole)})` : ''}`
        : 'No approval decision recorded';
      const decidedAt = approval.decidedAt ? ` · ${escapeHtml(formatDate(approval.decidedAt))}` : '';
      approvalSummary.innerHTML = `<strong>Approval:</strong> ${escapeHtml(approval.status || 'NOT_REQUIRED')}${approval.approverLabel ? ` · ${escapeHtml(approval.approverLabel)}` : ''}<br><span>${decided}${decidedAt}</span>${approval.reason ? `<br><span>Note: ${escapeHtml(approval.reason)}</span>` : ''}`;
    }
    const reconciliationDetail = document.getElementById('report-reconciliation-detail');
    if (reconciliationDetail) {
      const affectedRows = Array.isArray(reconciliation.affectedRows) ? reconciliation.affectedRows : [];
      const sourceRows = Number(reconciliation.sourceRows || 0);
      const accountedRows = Number(reconciliation.accountedRows || 0);
      const summary = `Reconciliation: ${escapeHtml(reconciliation.status || 'PENDING')} · ${accountedRows.toLocaleString()} of ${sourceRows.toLocaleString()} source rows accounted for.`;
      const rowsList = affectedRows.length
        ? `<h5>Rows to review</h5><ul>${affectedRows.map(item => `<li>Row #${Number(item.rowIndex).toLocaleString()}: ${escapeHtml(item.message)}</li>`).join('')}</ul>`
        : '';
      reconciliationDetail.innerHTML = `${summary}${rowsList}`;
    }

    const retryCard = document.getElementById('retry-action-card');
    if (retryCard) retryCard.style.display = Number(report.failedRecordsSummary?.totalFailed || execution.failed || 0) > 0 ? 'block' : 'none';
  } catch (err) {
    showToast('Failed to load final report: ' + err.message, 'error');
  }
}

function openExportModal() {
  const backdrop = document.getElementById('modal-export-backdrop');
  const modal = document.getElementById('modal-export-cleaned');
  if (!backdrop || !modal) return;
  const entityName = state.currentImport?.targetEntity || document.getElementById('select-target-entity')?.value || 'dataset';
  const entity = state.entities.find(e => e.entity === entityName);
  const fields = entity ? Object.keys(entity.fields) : [];

  const entityEl = document.getElementById('export-modal-entity-name');
  if (entityEl) entityEl.textContent = entityName.toUpperCase();
  const colEl = document.getElementById('export-modal-col-count');
  if (colEl) colEl.textContent = `${fields.length} columns`;

  backdrop.style.display = 'block';
  modal.style.display = 'block';
}

function closeExportModal() {
  const backdrop = document.getElementById('modal-export-backdrop');
  const modal = document.getElementById('modal-export-cleaned');
  if (backdrop) backdrop.style.display = 'none';
  if (modal) modal.style.display = 'none';
}

async function triggerExportDownload() {
  if (!state.currentImportId) {
    showToast('No active import session to export', 'error');
    return;
  }
  try {
    const formatRadio = document.querySelector('input[name="export-format-radio"]:checked');
    const format = formatRadio ? formatRadio.value : 'csv';
    const scope = document.getElementById('select-export-scope')?.value || 'cleaned';

    showToast(`Generating ${format.toUpperCase()} export...`, 'info');
    closeExportModal();

    const response = await fetch(`/api/v1/data-imports/${state.currentImportId}/export-cleaned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': state.currentRole || 'ADMIN',
        'X-Organization-Id': state.currentOrganizationId || 'org-master-101'
      },
      body: JSON.stringify({ format, scope })
    });

    if (!response.ok) {
      throw new Error(`Export server responded with status ${response.status}`);
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `${state.currentImport?.targetEntity || 'cleaned_dataset'}_${scope}.${format}`;
    if (contentDisposition && contentDisposition.includes('filename=')) {
      filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showToast(`Export complete: downloaded ${filename}`, 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

// Dirty State Tracking Helpers
function markCurrentStepDirty() {
  state.isStepDirty = true;
}

function clearCurrentStepDirty() {
  state.isStepDirty = false;
}

function isCurrentStepDirty() {
  if (state.isStepDirty) return true;
  if (state.currentStep === 2 && state.selectedFile != null) return true;
  if (state.currentStep === 4 && state.pendingCorrections && Object.keys(state.pendingCorrections).length > 0) return true;
  return false;
}

async function revertCurrentStepChanges() {
  if (!state.currentImportId) return true;
  try {
    // 1. Revert any backend changes for the current step (e.g. duplicate scan patches)
    await apiRequest(`/${state.currentImportId}/revert-step`, {
      method: 'POST',
      body: JSON.stringify({ step: state.currentStep })
    });

    // 2. Re-fetch the true last saved state from the backend
    const res = await fetch(`/api/v1/data-imports/${state.currentImportId}`, {
      headers: {
        'X-User-Role': state.currentRole || state.userContext?.role || 'ADMIN',
        'X-Organization-Id': state.currentOrganizationId || state.userContext?.organizationId || 'org-master-101'
      }
    });
    if (res.ok) {
      const result = await res.json();
      if (result.data) {
        state.currentImport = result.data;
      }
    }

    // 3. Re-render UI inputs from the fresh state
    if (state.currentStep === 1) {
      if (state.currentImport) {
        const nameEl = document.getElementById('input-job-name');
        const entityEl = document.getElementById('select-target-entity');
        const descEl = document.getElementById('input-job-description');
        if (nameEl) nameEl.value = state.currentImport.name || '';
        if (entityEl) entityEl.value = state.currentImport.targetEntity || '';
        if (descEl) descEl.value = state.currentImport.description || '';
      }
    } else if (state.currentStep === 2) {
      state.selectedFile = null;
      if (state.currentImport && state.currentImport.fileName) {
        showExistingFileOnStep2(state.currentImport);
        populateImportOptions(state.currentImport);
      } else {
        clearStep2FileUi({ clearState: true });
      }
    } else if (state.currentStep === 3) {
      await loadMappingSuggestions();
    } else if (state.currentStep === 4) {
      state.pendingCorrections = {};
      await loadValidationPreview();
    } else if (state.currentStep === 5) {
      if (state.currentImport) populateImportOptions(state.currentImport);
      resetStep5DuplicateUi();
    } else if (state.currentStep === 6) {
      if (state.currentImport) {
        const notesEl = document.getElementById('input-review-notes');
        if (notesEl) notesEl.value = state.currentImport.importOptions?.reviewNotes || '';
      }
    } else if (state.currentStep === 7) {
      if (state.currentImport) {
        const notesEl = document.getElementById('input-approval-notes');
        if (notesEl) notesEl.value = state.currentImport.importOptions?.approvalNotes || '';
      }
    }
    return true;
  } catch (err) {
    showToast('Could not leave this step without saving: ' + err.message, 'error');
    return false;
  }
}

async function saveCurrentImportAsDraft(resumeStep = state.currentStep) {
  if (!state.currentImportId) return true;
  try {
    if (state.currentStep === 1) {
      const name = document.getElementById('input-job-name')?.value?.trim();
      const targetEntity = document.getElementById('select-target-entity')?.value;
      const description = document.getElementById('input-job-description')?.value?.trim();
      if (name && targetEntity) {
        await apiRequest(`/${state.currentImportId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, targetEntity, description })
        });
      }
    } else if (state.currentStep === 2) {
      if (state.selectedFile) {
        const formData = new FormData();
        formData.append('file', state.selectedFile);
        const uploaded = await apiRequest(`/${state.currentImportId}/upload`, {
          method: 'POST',
          body: formData
        });
        state.currentImport = uploaded;
        state.selectedFile = null;
      }
      const batchSize = Number(document.getElementById('input-batch-size')?.value || 500);
      const skipHeaderRows = Number(document.getElementById('input-header-row')?.value || 0);
      const timezone = document.getElementById('input-timezone')?.value?.trim() || 'UTC';
      const errorStrategy = document.getElementById('select-error-strategy')?.value || 'CONTINUE_ON_ERROR';
      const duplicateStrategy = document.getElementById('select-import-duplicate-strategy')?.value || 'SKIP';
      await apiRequest(`/${state.currentImportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ importOptions: { batchSize, skipHeaderRows, timezone, errorStrategy, duplicateStrategy } })
      });
    } else if (state.currentStep === 3) {
      const mappings = extractMappingsFromTable();
      if (mappings.length > 0) {
        await apiRequest(`/${state.currentImportId}/mapping`, {
          method: 'POST',
          body: JSON.stringify({
            columnMappings: mappings.reduce((acc, mapping) => {
              acc[mapping.sourceColumn] = {
                targetField: mapping.targetField,
                mappingMethod: 'MANUAL',
                enabled: true,
                transformations: mapping.transformations || []
              };
              return acc;
            }, {})
          })
        });
      }
    } else if (state.currentStep === 4) {
      if (state.pendingCorrections && Object.keys(state.pendingCorrections).length > 0) {
        const correctionsList = Object.values(state.pendingCorrections);
        await apiRequest(`/${state.currentImportId}/records/correct`, {
          method: 'POST',
          body: JSON.stringify({ corrections: correctionsList })
        });
        state.pendingCorrections = {};
      }
    } else if (state.currentStep === 5) {
      const duplicateStrategy = document.getElementById('select-import-duplicate-strategy')?.value || 'SKIP';
      await apiRequest(`/${state.currentImportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ importOptions: { ...(state.currentImport?.importOptions || {}), duplicateStrategy } })
      });
    } else if (state.currentStep === 6) {
      const reviewNotes = document.getElementById('input-review-notes')?.value?.trim();
      if (reviewNotes !== undefined) {
        await apiRequest(`/${state.currentImportId}`, {
          method: 'PATCH',
          body: JSON.stringify({ importOptions: { ...(state.currentImport?.importOptions || {}), reviewNotes } })
        });
      }
    } else if (state.currentStep === 7) {
      const approvalNotes = document.getElementById('input-approval-notes')?.value?.trim();
      if (approvalNotes !== undefined) {
        await apiRequest(`/${state.currentImportId}`, {
          method: 'PATCH',
          body: JSON.stringify({ importOptions: { ...(state.currentImport?.importOptions || {}), approvalNotes } })
        });
      }
    }

    const draft = await apiRequest(`/${state.currentImportId}/save-draft`, {
      method: 'POST',
      body: JSON.stringify({ currentStep: resumeStep })
    });
    state.currentImport = draft;
    window.localStorage.setItem('dataImport.currentImportId', draft.id);
    window.localStorage.setItem('dataImport.currentStep', String(resumeStep));
    clearCurrentStepDirty();
    showToast('Draft saved successfully.', 'success');
    return true;
  } catch (err) {
    showToast('Could not save draft: ' + err.message, 'error');
    return false;
  }
}

async function saveDraftAndReturnToPreviousStep() {
  const previousStep = Math.max(1, state.currentStep - 1);
  const saved = await saveCurrentImportAsDraft(previousStep);
  if (saved) goToWizardStep(previousStep, true);
}

function openDraftModal(onLeave, onSave) {
  const backdrop = document.getElementById('modal-draft-backdrop');
  const dialogWrapper = document.getElementById('modal-draft-dialog-wrapper');
  const modal = document.getElementById('modal-save-draft');
  if (!backdrop || !modal) return;

  backdrop.style.display = 'block';
  if (dialogWrapper) dialogWrapper.style.display = 'flex';
  modal.style.display = 'block';

  const btnCloseX = document.getElementById('btn-draft-close-x');
  const btnCancel = document.getElementById('btn-draft-cancel');
  const btnLeave = document.getElementById('btn-draft-leave-without-save');
  const btnSave = document.getElementById('btn-draft-save');

  const closeDraftModal = () => {
    backdrop.style.display = 'none';
    if (dialogWrapper) dialogWrapper.style.display = 'none';
    modal.style.display = 'none';
  };

  if (btnCloseX) btnCloseX.onclick = closeDraftModal;
  if (btnCancel) btnCancel.onclick = closeDraftModal;

  if (btnLeave) {
    btnLeave.onclick = async () => {
      closeDraftModal();
      if (onLeave) await onLeave();
    };
  }

  if (btnSave) {
    btnSave.onclick = async () => {
      btnSave.disabled = true;
      try {
        const saved = onSave ? await onSave() : true;
        if (saved !== false) closeDraftModal();
      } finally {
        btnSave.disabled = false;
      }
    };
  }
}

function setupDraftAwareWizardBacks() {
  const targets = {
    'btn-step2-back': 1,
    'btn-step3-back': 2,
    'btn-step4-back': 3,
    'btn-step5-back': 4,
    'btn-step6-back': 5,
    'btn-step7-back': 6,
    'btn-step8-back': 7,
    'btn-step9-back': 8,
    'btn-step10-back': 9
  };

  Object.entries(targets).forEach(([id, targetStep]) => {
    const el = document.getElementById(id);
    if (!el) return;

    // Replace node to clear any legacy direct click listeners
    const freshEl = el.cloneNode(true);
    if (el.parentNode) el.parentNode.replaceChild(freshEl, el);
    freshEl.dataset.draftAware = 'true';

    freshEl.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const currentStep = state.currentStep || (targetStep + 1);
      const status = state.currentImport?.status;

      // Execution safety check: prevent undoing committed database changes
      if (currentStep >= 8 && ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'PROCESSING', 'RECONCILIATION_REQUIRED'].includes(status)) {
        if (targetStep < 8) {
          showToast('Import execution has completed. Committed database changes cannot be undone.', 'warning');
          return;
        }
      }

      // Show Save your progress confirmation popup modal
      openDraftModal(
        // Leave Without Saving action: discard current step changes and navigate back
        async () => {
          const reverted = await revertCurrentStepChanges();
          if (!reverted) return false;
          clearCurrentStepDirty();
          goToWizardStep(targetStep, true);
          return true;
        },
        // Save as Draft action: persist current step state and navigate back
        async () => {
          const saved = await saveCurrentImportAsDraft(targetStep);
          if (!saved) return false;
          clearCurrentStepDirty();
          goToWizardStep(targetStep, true);
          return true;
        }
      );
    });
  });
}

function setupReportExportEvents() {
  document.getElementById('btn-trigger-export-download')?.addEventListener('click', triggerExportDownload);
  document.getElementById('btn-download-cleaned-final')?.addEventListener('click', openExportModal);

  const directCleanedExport = async (format) => {
    if (!state.currentImportId) {
      showToast('No active import session to export', 'error');
      return;
    }
    try {
      showToast(`Generating cleaned ${format.toUpperCase()}...`, 'info');
      const response = await fetch(`/api/v1/data-imports/${state.currentImportId}/export-cleaned?format=${encodeURIComponent(format)}&scope=cleaned`, {
        headers: {
          'X-User-Role': state.currentRole || 'ADMIN',
          'X-Organization-Id': state.currentOrganizationId || 'org-master-101'
        }
      });
      if (!response.ok) throw new Error(`Cleaned data export failed (${response.status})`);
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match ? match[1] : `cleaned_${state.currentImport?.targetEntity || 'dataset'}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${filename}`, 'success');
    } catch (err) {
      showToast('Cleaned data download failed: ' + err.message, 'error');
    }
  };

  document.getElementById('btn-download-cleaned-csv')?.addEventListener('click', () => directCleanedExport('csv'));
  document.getElementById('btn-download-cleaned-xlsx')?.addEventListener('click', () => directCleanedExport('xlsx'));
  document.getElementById('btn-download-cleaned-pdf')?.addEventListener('click', () => directCleanedExport('pdf'));
  document.getElementById('btn-download-cleaned-docx')?.addEventListener('click', () => directCleanedExport('docx'));

  document.querySelectorAll('.report-format-download').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!state.currentImportId) return;
      const format = button.dataset.reportFormat || 'csv';
      try {
        showToast(`Generating ${format.toUpperCase()} final report...`, 'info');
        const response = await fetch(`/api/v1/data-imports/${state.currentImportId}/report/export?format=${encodeURIComponent(format)}`, {
          headers: {
            'X-User-Role': state.currentRole || 'ADMIN',
            'X-Organization-Id': state.currentOrganizationId || 'org-master-101'
          }
        });
        if (!response.ok) throw new Error(`Report export failed (${response.status})`);
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^";]+)"?/i);
        const filename = match ? match[1] : `import_report_${state.currentImportId}.${format}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`Downloaded ${filename}`, 'success');
      } catch (err) {
        showToast('Report download failed: ' + err.message, 'error');
      }
    });
  });

  document.getElementById('btn-download-failed-csv')?.addEventListener('click', () => {
    if (!state.currentImportId) return;
    window.open(`/api/v1/data-imports/${state.currentImportId}/failed-records/export`, '_blank');
    showToast('Failed records CSV download initiated', 'info');
  });

  document.getElementById('btn-retry-failed-records')?.addEventListener('click', async () => {
    if (!state.currentImportId) return;
    try {
      const retryRes = await apiRequest(`/${state.currentImportId}/retry`, { method: 'POST' });
      showToast(`Retry complete! Succeeded: ${retryRes.newlySucceeded || 0}`, 'success');
      await loadFinalReport();
    } catch (err) {
      showToast('Retry failed: ' + err.message, 'error');
    }
  });
}

// =============================================================================
// SCHEMAS VIEW & AUDIT VIEW LOGIC
// =============================================================================
async function loadSchemasView() {
  const container = document.getElementById('schemas-container');
  if (!container) return;

  try {
    const schemas = await apiRequest(state.activeDepartment ? `/departments/${encodeURIComponent(state.activeDepartment.id)}/schemas` : '/entities');
    container.innerHTML = schemas.map(s => `
      <div class="card mb-4" style="margin-bottom: 20px;">
        <div class="card-header flex-between">
          <div>
            <h3 class="card-title">${escapeHtml(s.displayName)} (${escapeHtml(s.entity)})</h3>
            <p class="card-subtitle">${escapeHtml(s.description || '')}</p>
          </div>
          <span class="badge badge-purple">Module: ${s.module}</span>
        </div>
        <div class="card-body">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Field Name</th>
                  <th>Label</th>
                  <th>Data Type</th>
                  <th>Required</th>
                  <th>Unique</th>
                  <th>Aliases</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(s.fields || {}).map(f => `
                  <tr>
                    <td style="font-family:var(--font-mono); font-weight:600;">${escapeHtml(f.name)}</td>
                    <td>${escapeHtml(f.label)}</td>
                    <td><span class="badge badge-info">${f.type}</span></td>
                    <td>${f.required ? '<span class="text-green">✓ Required</span>' : '<span class="text-muted">Optional</span>'}</td>
                    <td>${f.unique ? '<span class="text-blue">Unique</span>' : '-'}</td>
                    <td style="font-size:0.75rem; color:var(--text-muted);">${(f.aliases || []).join(', ') || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showToast('Failed to load schemas: ' + err.message, 'error');
  }
}

async function loadAuditLogsView() {
  const tbody = document.getElementById('audit-table-body');
  if (!tbody) return;

  document.getElementById('btn-refresh-audit')?.addEventListener('click', loadAuditLogsView);

  const importId = state.currentImportId;
  if (!importId) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <p>Select/open an import to view its real audit trail.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  try {
    const logs = await apiRequest(`/${importId}/audit`);
    state.auditLogs = Array.isArray(logs) ? logs : [];

    if (state.auditLogs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state"><p>No audit events recorded for this import.</p></div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.auditLogs.map((log) => `
      <tr>
        <td>${escapeHtml(formatDate(log.timestamp))}</td>
        <td><span class="badge badge-info">${escapeHtml(log.action || '-')}</span></td>
        <td>${escapeHtml(log.actorUserId || 'SYSTEM')}</td>
        <td>${escapeHtml(log.importId || importId)}</td>
        <td style="font-size:0.8rem;">${escapeHtml(JSON.stringify(log.details || {}))}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load audit logs: ' + err.message, 'error');
  }
}

// Utility: Escape HTML
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
