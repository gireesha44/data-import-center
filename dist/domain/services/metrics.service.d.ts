/**
 * Metrics and Observability Service
 */
export interface MetricCounter {
    name: string;
    value: number;
    tags?: Record<string, string>;
}
export interface MetricHistogram {
    name: string;
    values: number[];
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    tags?: Record<string, string>;
}
export declare class MetricsService {
    private counters;
    private histograms;
    increment(name: string, value?: number, tags?: Record<string, string>): void;
    recordDuration(name: string, durationMs: number, tags?: Record<string, string>): void;
    getCounter(name: string, tags?: Record<string, string>): number;
    getHistogram(name: string, tags?: Record<string, string>): MetricHistogram | null;
    getMetricsSummary(): Record<string, unknown>;
    reset(): void;
    private formatKey;
}
export declare const metricsService: MetricsService;
//# sourceMappingURL=metrics.service.d.ts.map