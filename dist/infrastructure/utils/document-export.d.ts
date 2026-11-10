export interface DocumentSection {
    heading: string;
    rows: Array<[string, string]>;
    table?: {
        columns: string[];
        rows: string[][];
    };
}
export declare function buildDocxDocument(title: string, sections: DocumentSection[]): Buffer;
export declare function buildPdfDocument(title: string, lines: string[]): Buffer;
/** Standards-compliant, readable PDF report with section headings and key/value rows. */
export declare function buildPdfSummaryDocument(title: string, sections: DocumentSection[]): Buffer;
//# sourceMappingURL=document-export.d.ts.map