/**
 * Tier 3 Cross-Field Validators
 */
export class DateRangeCrossFieldValidator {
    name = 'DATE_RANGE_CROSS_FIELD_VALIDATOR';
    validate(row, _schema, _context) {
        const issues = [];
        // Check issue_date vs due_date
        if (row['issue_date'] && row['due_date']) {
            const issue = new Date(String(row['issue_date'])).getTime();
            const due = new Date(String(row['due_date'])).getTime();
            if (!isNaN(issue) && !isNaN(due) && issue > due) {
                issues.push({
                    field: 'due_date',
                    code: 'INVALID_DATE_RANGE',
                    severity: 'ERROR',
                    message: `Due Date (${row['due_date']}) cannot be earlier than Issue Date (${row['issue_date']})`,
                    transformedValue: row['due_date']
                });
            }
        }
        // Check start_date vs end_date
        if (row['start_date'] && row['end_date']) {
            const start = new Date(String(row['start_date'])).getTime();
            const end = new Date(String(row['end_date'])).getTime();
            if (!isNaN(start) && !isNaN(end) && start > end) {
                issues.push({
                    field: 'end_date',
                    code: 'INVALID_DATE_RANGE',
                    severity: 'ERROR',
                    message: `End Date (${row['end_date']}) cannot be earlier than Start Date (${row['start_date']})`,
                    transformedValue: row['end_date']
                });
            }
        }
        return issues;
    }
}
//# sourceMappingURL=cross-field.validators.js.map