/**
 * Metrics and Observability Service
 */
export class MetricsService {
    counters = new Map();
    histograms = new Map();
    increment(name, value = 1, tags) {
        const key = this.formatKey(name, tags);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + value);
    }
    recordDuration(name, durationMs, tags) {
        const key = this.formatKey(name, tags);
        const list = this.histograms.get(key) || [];
        list.push(durationMs);
        this.histograms.set(key, list);
    }
    getCounter(name, tags) {
        const key = this.formatKey(name, tags);
        return this.counters.get(key) || 0;
    }
    getHistogram(name, tags) {
        const key = this.formatKey(name, tags);
        const values = this.histograms.get(key);
        if (!values || values.length === 0)
            return null;
        const sum = values.reduce((acc, v) => acc + v, 0);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = sum / values.length;
        return {
            name,
            values,
            count: values.length,
            sum,
            min,
            max,
            avg,
            tags
        };
    }
    getMetricsSummary() {
        const countersObj = {};
        for (const [k, v] of this.counters.entries()) {
            countersObj[k] = v;
        }
        const histogramsObj = {};
        for (const [k, v] of this.histograms.entries()) {
            const sum = v.reduce((acc, n) => acc + n, 0);
            histogramsObj[k] = {
                count: v.length,
                avg: v.length ? Math.round((sum / v.length) * 100) / 100 : 0,
                min: v.length ? Math.min(...v) : 0,
                max: v.length ? Math.max(...v) : 0
            };
        }
        return {
            uptimeSeconds: process.uptime(),
            timestamp: new Date().toISOString(),
            counters: countersObj,
            histograms: histogramsObj
        };
    }
    reset() {
        this.counters.clear();
        this.histograms.clear();
    }
    formatKey(name, tags) {
        if (!tags || Object.keys(tags).length === 0)
            return name;
        const sortedTags = Object.entries(tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${name}{${sortedTags}}`;
    }
}
export const metricsService = new MetricsService();
//# sourceMappingURL=metrics.service.js.map