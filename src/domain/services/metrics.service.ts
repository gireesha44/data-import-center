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

export class MetricsService {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  public increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.formatKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  public recordDuration(name: string, durationMs: number, tags?: Record<string, string>): void {
    const key = this.formatKey(name, tags);
    const list = this.histograms.get(key) || [];
    list.push(durationMs);
    this.histograms.set(key, list);
  }

  public getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.formatKey(name, tags);
    return this.counters.get(key) || 0;
  }

  public getHistogram(name: string, tags?: Record<string, string>): MetricHistogram | null {
    const key = this.formatKey(name, tags);
    const values = this.histograms.get(key);
    if (!values || values.length === 0) return null;

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

  public getMetricsSummary(): Record<string, unknown> {
    const countersObj: Record<string, number> = {};
    for (const [k, v] of this.counters.entries()) {
      countersObj[k] = v;
    }

    const histogramsObj: Record<string, unknown> = {};
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

  public reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  private formatKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) return name;
    const sortedTags = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${sortedTags}}`;
  }
}

export const metricsService = new MetricsService();
