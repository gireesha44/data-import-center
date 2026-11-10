/**
 * Pure Deterministic Duplicate Detection & Record Matching Engine
 */
import { MatchClassification, MatchConfidence, ExecutionIntentAction } from '../../core/types/duplicate.types.js';
import { DuplicateStrategy, ImportMode, RecordStatus } from '../../core/types/import.types.js';
import { entitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { MatchKeyGenerator } from './match-key.generator.js';
export class DuplicateDetectionEngine {
    /**
     * Executes duplicate detection, intra-file grouping, target matching, and execution intent calculation
     */
    static async evaluateDataset(records, options) {
        const registry = options.schemaRegistry || entitySchemaRegistry;
        const schema = registry.getEntity(options.entityName);
        const duplicateRule = schema?.duplicateRules?.find((r) => r.isDefault) || schema?.duplicateRules?.[0];
        const importMode = options.importMode || ImportMode.UPSERT;
        const strategy = options.duplicateStrategy || DuplicateStrategy.SKIP;
        const matchResults = new Map();
        const intents = new Map();
        // 1. Initial categorization: Identify invalid, unresolved, and compute candidate match keys
        const candidateMap = new Map();
        const intraFileKeyMap = new Map();
        let validCount = 0;
        let invalidCount = 0;
        let unresolvedCount = 0;
        for (const record of records) {
            // Step 1: Check validation status and exclude invalid or skipped/rejected records
            const isSkipped = record.executionAction === ExecutionIntentAction.SKIP ||
                record.status === RecordStatus.SKIPPED_DUPLICATE ||
                record.status === RecordStatus.SKIPPED;
            const isRejected = record.executionAction === ExecutionIntentAction.REJECT ||
                record.status === RecordStatus.REJECTED;
            if (isSkipped) {
                const matchRes = {
                    recordId: record.id,
                    sourceRowNumber: record.rowIndex,
                    classification: record.matchClassification || (record.targetRecordId ? MatchClassification.EXISTING : MatchClassification.DUPLICATE_IN_FILE),
                    matchStrategy: duplicateRule?.name || 'NONE',
                    matchKey: record.matchKey || null,
                    matchKeyHash: record.matchKeyHash || null,
                    confidence: MatchConfidence.NONE,
                    reasons: ['Skipped by user during duplicate resolution'],
                    issues: []
                };
                matchResults.set(record.id, matchRes);
                intents.set(record.id, {
                    recordId: record.id,
                    action: ExecutionIntentAction.SKIP,
                    reason: record.executionReason || 'Skipped by user during duplicate resolution',
                    matchResult: matchRes,
                    blocked: false,
                    blockedReason: null
                });
                continue;
            }
            if (isRejected) {
                const dataToMatch = record.transformedData || record.rawData;
                const keyInfo = duplicateRule
                    ? MatchKeyGenerator.generateMatchKey(dataToMatch, duplicateRule, schema?.fields)
                    : null;
                const matchRes = {
                    recordId: record.id,
                    sourceRowNumber: record.rowIndex,
                    classification: record.matchClassification || (record.targetRecordId ? MatchClassification.EXISTING : MatchClassification.DUPLICATE_IN_FILE),
                    matchStrategy: duplicateRule?.name || 'NONE',
                    matchKey: keyInfo?.displayKey || record.matchKey || null,
                    matchKeyHash: keyInfo?.hash || record.matchKeyHash || null,
                    confidence: MatchConfidence.NONE,
                    reasons: ['Rejected by user during duplicate resolution'],
                    issues: []
                };
                matchResults.set(record.id, matchRes);
                intents.set(record.id, {
                    recordId: record.id,
                    action: ExecutionIntentAction.REJECT,
                    reason: record.executionReason || 'Rejected by user during duplicate resolution',
                    matchResult: matchRes,
                    blocked: true,
                    blockedReason: record.blockedReason || 'Rejected by user'
                });
                if (keyInfo) {
                    const group = intraFileKeyMap.get(keyInfo.hash) || [];
                    group.push(record);
                    intraFileKeyMap.set(keyInfo.hash, group);
                    candidateMap.set(record.id, { record, keyInfo });
                }
                continue;
            }
            const recordData = record.transformedData || record.rawData || {};
            const hasInvalidPlaceholder = Object.values(recordData).some((v) => typeof v === 'string' && (v.includes('###INVALID###') || v.startsWith('###')));
            if (record.status === RecordStatus.INVALID ||
                record.hasErrors() ||
                hasInvalidPlaceholder) {
                invalidCount++;
                const matchRes = {
                    recordId: record.id,
                    sourceRowNumber: record.rowIndex,
                    classification: MatchClassification.INVALID,
                    matchStrategy: duplicateRule?.name || 'NONE',
                    matchKey: null,
                    matchKeyHash: null,
                    confidence: MatchConfidence.NONE,
                    reasons: ['Record contains validation errors or invalid placeholders and cannot undergo duplicate matching'],
                    issues: [{
                            code: 'VALIDATION_FAILED',
                            message: 'Record contains validation errors or invalid placeholders',
                            severity: 'ERROR'
                        }]
                };
                matchResults.set(record.id, matchRes);
                intents.set(record.id, {
                    recordId: record.id,
                    action: ExecutionIntentAction.BLOCKED,
                    reason: 'Record contains validation errors',
                    matchResult: matchRes,
                    blocked: true,
                    blockedReason: 'Validation errors present'
                });
                continue;
            }
            validCount++;
            // Step 2: Generate Match Key using normalized field values
            const dataToMatch = record.transformedData || record.rawData;
            const keyInfo = duplicateRule
                ? MatchKeyGenerator.generateMatchKey(dataToMatch, duplicateRule, schema?.fields)
                : null;
            if (!keyInfo) {
                unresolvedCount++;
                const matchRes = {
                    recordId: record.id,
                    sourceRowNumber: record.rowIndex,
                    classification: MatchClassification.UNRESOLVED,
                    matchStrategy: duplicateRule?.name || 'NONE',
                    matchKey: null,
                    matchKeyHash: null,
                    confidence: MatchConfidence.NONE,
                    reasons: [
                        duplicateRule
                            ? `Missing required match key field(s): [${duplicateRule.fields.join(', ')}]`
                            : 'No duplicate rule configured for entity'
                    ],
                    issues: [{
                            code: 'MATCH_KEY_MISSING',
                            message: 'Cannot construct unambiguous match key from empty/missing fields',
                            severity: 'WARNING'
                        }]
                };
                matchResults.set(record.id, matchRes);
                intents.set(record.id, {
                    recordId: record.id,
                    action: ExecutionIntentAction.BLOCKED,
                    reason: 'Missing required match key',
                    matchResult: matchRes,
                    blocked: true,
                    blockedReason: 'Unresolved match key'
                });
                continue;
            }
            // Group records by match key hash for intra-file duplicate detection (sorted by rowIndex ascending)
            const group = intraFileKeyMap.get(keyInfo.hash) || [];
            group.push(record);
            intraFileKeyMap.set(keyInfo.hash, group);
            candidateMap.set(record.id, { record, keyInfo });
        }
        // Step 3: Collect keys for batch target DB lookup
        const targetCandidateHashes = Array.from(intraFileKeyMap.keys());
        const targetCandidateKeys = targetCandidateHashes.map((hash) => candidateMap.get(intraFileKeyMap.get(hash)[0].id).keyInfo.displayKey);
        let targetMatchesMap = new Map();
        if (options.targetProvider && targetCandidateHashes.length > 0) {
            targetMatchesMap = await options.targetProvider.findByMatchKeys(options.organizationId, targetCandidateHashes, targetCandidateKeys);
        }
        // Step 4: Classify groups, records, and assign execution intents
        const duplicateGroups = [];
        let groupIndexCounter = 1;
        let newCount = 0;
        let existingCount = 0;
        let duplicateInFileCount = 0;
        let multipleMatchesCount = 0;
        let conflictsCount = 0;
        for (const [hash, groupRecords] of intraFileKeyMap.entries()) {
            // The first valid occurrence in file is ALWAYS the primary record
            const firstRecord = groupRecords[0];
            const keyInfo = candidateMap.get(firstRecord.id).keyInfo;
            const targetMatches = targetMatchesMap.get(hash) || [];
            const hasInFileDuplicates = groupRecords.length > 1;
            const hasSingleTargetMatch = targetMatches.length === 1;
            const hasMultipleTargetMatches = targetMatches.length > 1;
            // CASE 1: Completely Unique (No DB match, No in-file duplicates)
            if (!hasInFileDuplicates && !hasSingleTargetMatch && !hasMultipleTargetMatches) {
                newCount++;
                const matchRes = {
                    recordId: firstRecord.id,
                    sourceRowNumber: firstRecord.rowIndex,
                    classification: MatchClassification.NEW,
                    matchStrategy: duplicateRule?.name || 'EXACT',
                    matchKey: keyInfo.displayKey,
                    matchKeyHash: hash,
                    matchedTargetId: null,
                    confidence: MatchConfidence.EXACT,
                    reasons: ['No existing target record matched; unique in file'],
                    issues: []
                };
                matchResults.set(firstRecord.id, matchRes);
                let action = ExecutionIntentAction.CREATE;
                let blocked = false;
                let blockedReason = null;
                if (importMode === ImportMode.UPDATE_ONLY) {
                    action = ExecutionIntentAction.BLOCKED;
                    blocked = true;
                    blockedReason = 'Target record does not exist for UPDATE_ONLY mode';
                }
                intents.set(firstRecord.id, {
                    recordId: firstRecord.id,
                    action,
                    targetId: null,
                    reason: 'No existing target record found; ready for creation',
                    matchResult: matchRes,
                    blocked,
                    blockedReason
                });
                continue;
            }
            // CASE 2: Ambiguous Multiple Target Matches
            if (hasMultipleTargetMatches) {
                multipleMatchesCount++;
                conflictsCount++;
                const candidateIds = targetMatches.map((m) => m.id);
                for (const record of groupRecords) {
                    const matchRes = {
                        recordId: record.id,
                        sourceRowNumber: record.rowIndex,
                        classification: MatchClassification.MULTIPLE_MATCH,
                        matchStrategy: duplicateRule?.name || 'EXACT',
                        matchKey: keyInfo.displayKey,
                        matchKeyHash: hash,
                        candidateTargetIds: candidateIds,
                        confidence: MatchConfidence.EXACT,
                        reasons: [
                            `Multiple target records (${targetMatches.length}) matched unique key '${keyInfo.displayKey}'. Candidate IDs: [${candidateIds.join(', ')}]`
                        ],
                        issues: [{
                                code: 'MULTIPLE_TARGET_MATCHES',
                                message: `Key matches multiple (${targetMatches.length}) existing target records`,
                                severity: 'ERROR'
                            }]
                    };
                    matchResults.set(record.id, matchRes);
                    intents.set(record.id, {
                        recordId: record.id,
                        action: ExecutionIntentAction.REVIEW,
                        targetId: null,
                        reason: 'Ambiguous multiple target record matches sent to Review',
                        matchResult: matchRes,
                        blocked: true,
                        blockedReason: 'Multiple target matches conflict'
                    });
                }
                const groupRecordsItems = groupRecords.map((r, idx) => ({
                    recordId: r.id,
                    sourceRowNumber: r.rowIndex,
                    role: idx === 0 ? 'PRIMARY' : 'DUPLICATE',
                    isPrimary: idx === 0,
                    data: (r.transformedData || r.rawData),
                    matchKey: keyInfo.displayKey,
                    matchedTargetId: candidateIds.join(', '),
                    targetRecordData: null,
                    resolutionAction: ExecutionIntentAction.REVIEW,
                    resolutionReason: `Ambiguous multiple database matches: ${candidateIds.join(', ')}`,
                    availableActions: ['SKIP', 'EDIT']
                }));
                duplicateGroups.push({
                    id: `grp-${groupIndexCounter}`,
                    groupIndex: groupIndexCounter++,
                    groupKey: keyInfo.displayKey,
                    matchKey: keyInfo.displayKey,
                    matchKeyHash: hash,
                    type: 'DATABASE_MATCH',
                    classification: MatchClassification.MULTIPLE_MATCH,
                    count: groupRecords.length,
                    recordsCount: groupRecords.length,
                    sourceRowNumbers: groupRecords.map((r) => r.rowIndex),
                    recordIds: groupRecords.map((r) => r.id),
                    primaryRecordId: firstRecord.id,
                    primaryRowNumber: firstRecord.rowIndex,
                    matchedTargetId: candidateIds.join(', '),
                    targetRecordData: null,
                    sampleRecordData: (firstRecord.transformedData || firstRecord.rawData),
                    status: 'REQUIRES_RESOLUTION',
                    resolutionAction: ExecutionIntentAction.REVIEW,
                    resolutionReason: `Ambiguous database matches: ${candidateIds.join(', ')}`,
                    records: groupRecordsItems
                });
                continue;
            }
            // CASE 3: Database Match (Single Target Match)
            if (hasSingleTargetMatch) {
                existingCount++;
                const matchedTarget = targetMatches[0];
                // Determine action based on strategy
                let action = ExecutionIntentAction.UPDATE;
                let blocked = false;
                let blockedReason = null;
                if (importMode === ImportMode.INSERT_ONLY || strategy === DuplicateStrategy.SKIP) {
                    action = ExecutionIntentAction.SKIP;
                }
                else if (hasInFileDuplicates &&
                    (strategy === DuplicateStrategy.SEND_FOR_REVIEW || strategy === 'MANUAL_REVIEW')) {
                    action = ExecutionIntentAction.REVIEW;
                    blocked = true;
                    blockedReason = 'Existing target record requires review';
                }
                else {
                    // UPDATE
                    action = ExecutionIntentAction.UPDATE;
                }
                const groupRecordsItems = [];
                for (let idx = 0; idx < groupRecords.length; idx++) {
                    const rec = groupRecords[idx];
                    const isPrimary = idx === 0;
                    const duplicateInFileAction = ExecutionIntentAction.REVIEW;
                    const recordAction = !isPrimary && groupRecords.length > 1
                        ? duplicateInFileAction
                        : action;
                    const recordBlocked = recordAction === ExecutionIntentAction.REVIEW;
                    if (!isPrimary)
                        duplicateInFileCount++;
                    const matchRes = {
                        recordId: rec.id,
                        sourceRowNumber: rec.rowIndex,
                        classification: isPrimary ? MatchClassification.EXISTING : MatchClassification.DUPLICATE_IN_FILE,
                        matchStrategy: duplicateRule?.name || 'EXACT',
                        matchKey: keyInfo.displayKey,
                        matchKeyHash: hash,
                        matchedTargetId: matchedTarget.id,
                        confidence: MatchConfidence.EXACT,
                        reasons: [`Matched existing target record (ID: ${matchedTarget.id}) on key: ${keyInfo.displayKey}`],
                        issues: []
                    };
                    matchResults.set(rec.id, matchRes);
                    intents.set(rec.id, {
                        recordId: rec.id,
                        action: recordAction,
                        targetId: matchedTarget.id,
                        reason: !isPrimary && groupRecords.length > 1
                            ? 'Duplicate in file requires user resolution'
                            : `Matched existing target record (ID: ${matchedTarget.id})`,
                        matchResult: matchRes,
                        blocked: recordBlocked,
                        blockedReason: recordBlocked
                            ? (!isPrimary && groupRecords.length > 1 ? 'Duplicate in file requires user resolution' : blockedReason)
                            : null
                    });
                    groupRecordsItems.push({
                        recordId: rec.id,
                        sourceRowNumber: rec.rowIndex,
                        role: isPrimary ? 'PRIMARY' : 'DUPLICATE',
                        isPrimary,
                        data: (rec.transformedData || rec.rawData),
                        matchKey: keyInfo.displayKey,
                        matchedTargetId: matchedTarget.id,
                        targetRecordData: matchedTarget.data,
                        resolutionAction: recordAction,
                        resolutionReason: recordAction === ExecutionIntentAction.UPDATE
                            ? 'Update existing database record'
                            : recordAction === ExecutionIntentAction.REVIEW
                                ? 'Flagged for review'
                                : 'Skipped database match',
                        availableActions: isPrimary ? ['EDIT'] : ['SKIP', 'EDIT']
                    });
                }
                duplicateGroups.push({
                    id: `grp-${groupIndexCounter}`,
                    groupIndex: groupIndexCounter++,
                    groupKey: keyInfo.displayKey,
                    matchKey: keyInfo.displayKey,
                    matchKeyHash: hash,
                    type: hasInFileDuplicates ? 'HYBRID_MATCH' : 'DATABASE_MATCH',
                    classification: MatchClassification.EXISTING,
                    count: groupRecords.length,
                    recordsCount: groupRecords.length,
                    sourceRowNumbers: groupRecords.map((r) => r.rowIndex),
                    recordIds: groupRecords.map((r) => r.id),
                    primaryRecordId: firstRecord.id,
                    primaryRowNumber: firstRecord.rowIndex,
                    matchedTargetId: matchedTarget.id,
                    targetRecordData: matchedTarget.data,
                    sampleRecordData: (firstRecord.transformedData || firstRecord.rawData),
                    status: 'REQUIRES_RESOLUTION',
                    resolutionAction: action,
                    resolutionReason: action === ExecutionIntentAction.UPDATE
                        ? 'Update existing database record'
                        : action === ExecutionIntentAction.REVIEW
                            ? 'Flagged for review'
                            : 'Skipped database match',
                    records: groupRecordsItems
                });
                continue;
            }
            // CASE 4: In-File Duplicates Only (No Target DB Match)
            // The first valid occurrence is the initial primary, but either row may be edited.
            // Subsequent occurrences are duplicate candidates with explicit resolution actions.
            newCount++; // The primary record will be inserted as a new record
            // Primary Record (Row 10):
            const primaryMatchRes = {
                recordId: firstRecord.id,
                sourceRowNumber: firstRecord.rowIndex,
                classification: MatchClassification.NEW,
                matchStrategy: duplicateRule?.name || 'EXACT',
                matchKey: keyInfo.displayKey,
                matchKeyHash: hash,
                matchedTargetId: null,
                confidence: MatchConfidence.EXACT,
                reasons: ['Canonical primary record; eligible for import until edited or resolved'],
                issues: []
            };
            const firstIsRejected = firstRecord.executionAction === ExecutionIntentAction.REJECT ||
                firstRecord.status === RecordStatus.REJECTED;
            if (!firstIsRejected) {
                matchResults.set(firstRecord.id, primaryMatchRes);
                intents.set(firstRecord.id, {
                    recordId: firstRecord.id,
                    action: ExecutionIntentAction.CREATE,
                    targetId: null,
                    reason: 'Canonical primary record; initially eligible for import',
                    matchResult: primaryMatchRes,
                    blocked: false,
                    blockedReason: null
                });
            }
            const groupRecordsItems = [
                {
                    recordId: firstRecord.id,
                    sourceRowNumber: firstRecord.rowIndex,
                    role: 'PRIMARY',
                    isPrimary: true,
                    data: (firstRecord.transformedData || firstRecord.rawData),
                    matchKey: keyInfo.displayKey,
                    matchedTargetId: null,
                    targetRecordData: null,
                    resolutionAction: firstIsRejected ? ExecutionIntentAction.REJECT : ExecutionIntentAction.CREATE,
                    resolutionReason: firstIsRejected
                        ? (firstRecord.executionReason || 'Rejected by user during duplicate resolution')
                        : 'Canonical primary record; initially eligible for import',
                    availableActions: ['EDIT']
                }
            ];
            // Subsequent Duplicates (Row 12, Row 13...):
            for (let i = 1; i < groupRecords.length; i++) {
                duplicateInFileCount++;
                const dupRecord = groupRecords[i];
                const matchRes = {
                    recordId: dupRecord.id,
                    sourceRowNumber: dupRecord.rowIndex,
                    classification: MatchClassification.DUPLICATE_IN_FILE,
                    matchStrategy: duplicateRule?.name || 'EXACT',
                    matchKey: keyInfo.displayKey,
                    matchKeyHash: hash,
                    confidence: MatchConfidence.EXACT,
                    reasons: [`Intra-file duplicate of row ${firstRecord.rowIndex} (Key: ${keyInfo.displayKey})`],
                    issues: [{
                            code: 'DUPLICATE_IN_FILE',
                            message: `Duplicate record within import file (matches row ${firstRecord.rowIndex})`,
                            severity: 'WARNING'
                        }]
                };
                matchResults.set(dupRecord.id, matchRes);
                const dupIsRejected = dupRecord.executionAction === ExecutionIntentAction.REJECT ||
                    dupRecord.status === RecordStatus.REJECTED;
                const dupAction = dupIsRejected
                    ? ExecutionIntentAction.REJECT
                    : (options.duplicateStrategy === DuplicateStrategy.SKIP
                        ? ExecutionIntentAction.SKIP
                        : ExecutionIntentAction.REVIEW);
                const blocked = dupAction === ExecutionIntentAction.REVIEW || dupIsRejected;
                const blockedReason = dupIsRejected
                    ? (dupRecord.blockedReason || 'Rejected by user')
                    : (dupAction === ExecutionIntentAction.REVIEW ? 'Duplicate in file requires user resolution' : null);
                intents.set(dupRecord.id, {
                    recordId: dupRecord.id,
                    action: dupAction,
                    reason: dupRecord.executionReason || (dupIsRejected
                        ? 'Rejected by user during duplicate resolution'
                        : `Intra-file duplicate of row ${firstRecord.rowIndex}`),
                    matchResult: matchRes,
                    blocked,
                    blockedReason
                });
                groupRecordsItems.push({
                    recordId: dupRecord.id,
                    sourceRowNumber: dupRecord.rowIndex,
                    role: 'DUPLICATE',
                    isPrimary: false,
                    data: (dupRecord.transformedData || dupRecord.rawData),
                    matchKey: keyInfo.displayKey,
                    matchedTargetId: null,
                    targetRecordData: null,
                    resolutionAction: dupAction,
                    resolutionReason: dupIsRejected
                        ? (dupRecord.executionReason || 'Rejected by user during duplicate resolution')
                        : (dupAction === ExecutionIntentAction.REVIEW
                            ? 'Flagged for review'
                            : `Intra-file duplicate of row ${firstRecord.rowIndex}`),
                    availableActions: ['SKIP', 'EDIT']
                });
            }
            if (groupRecords.length >= 2) {
                duplicateGroups.push({
                    id: `grp-${groupIndexCounter}`,
                    groupIndex: groupIndexCounter++,
                    groupKey: keyInfo.displayKey,
                    matchKey: keyInfo.displayKey,
                    matchKeyHash: hash,
                    type: 'IN_FILE_DUPLICATE',
                    classification: MatchClassification.DUPLICATE_IN_FILE,
                    count: groupRecords.length,
                    recordsCount: groupRecords.length,
                    sourceRowNumbers: groupRecords.map((r) => r.rowIndex),
                    recordIds: groupRecords.map((r) => r.id),
                    primaryRecordId: firstRecord.id,
                    primaryRowNumber: firstRecord.rowIndex,
                    matchedTargetId: null,
                    targetRecordData: null,
                    sampleRecordData: (firstRecord.transformedData || firstRecord.rawData),
                    status: 'REQUIRES_RESOLUTION',
                    resolutionAction: ExecutionIntentAction.REVIEW,
                    resolutionReason: 'In-file duplicates require individual resolution',
                    records: groupRecordsItems
                });
            }
        }
        // Only groups with at least two imported records belong in Duplicate Scan.
        const visibleDuplicateGroups = duplicateGroups.filter((group) => (group.recordsCount || group.records.length) >= 2);
        // Compute execution action counts
        let creates = 0;
        let updates = 0;
        let skips = 0;
        let reviews = 0;
        let blocked = 0;
        let rejected = 0;
        for (const intent of intents.values()) {
            switch (intent.action) {
                case ExecutionIntentAction.CREATE:
                    creates++;
                    break;
                case ExecutionIntentAction.UPDATE:
                    updates++;
                    break;
                case ExecutionIntentAction.SKIP:
                    skips++;
                    break;
                case ExecutionIntentAction.REJECT:
                    rejected++;
                    break;
                case ExecutionIntentAction.REVIEW:
                    reviews++;
                    break;
                case ExecutionIntentAction.BLOCKED:
                    blocked++;
                    break;
            }
        }
        const summary = {
            totalRecords: records.length,
            validRecords: validCount,
            invalidRecords: invalidCount,
            newRecords: creates, // Canonical primary records are counted as new inserts!
            existingRecords: existingCount,
            duplicateInFile: duplicateInFileCount,
            duplicateInTarget: existingCount,
            duplicateRecords: visibleDuplicateGroups.reduce((count, group) => count + group.records.length, 0),
            multipleMatches: multipleMatchesCount,
            conflicts: conflictsCount,
            unresolved: unresolvedCount,
            creates,
            updates,
            resolvedUpdates: 0,
            skips,
            rejected,
            reviews,
            blocked,
            duplicateGroups: visibleDuplicateGroups
        };
        return {
            matchResults,
            intents,
            summary
        };
    }
}
//# sourceMappingURL=duplicate-detection.engine.js.map