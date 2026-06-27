export interface ProviderMetrics {
  avgResponseTimeMs: number;
  lastSuccessAt: string | null;
  totalScrapes: number;
  successRate: number;
  history: number[]; // Last 20 response times
}

// In-memory storage for provider metrics
const metricsStore = new Map<string, ProviderMetrics>();

export class MetricsTracker {
  private metrics: ProviderMetrics = {
    avgResponseTimeMs: 0,
    lastSuccessAt: null,
    totalScrapes: 0,
    successRate: 0,
    history: []
  };

  private successes = 0;
  private failures = 0;

  record(responseTimeMs: number, success: boolean) {
    this.metrics.totalScrapes++;
    if (success) {
      this.successes++;
      this.metrics.lastSuccessAt = new Date().toISOString();
      this.metrics.history.push(responseTimeMs);
      if (this.metrics.history.length > 20) {
        this.metrics.history.shift();
      }
    } else {
      this.failures++;
    }

    // Calculate rolling average
    if (this.metrics.history.length > 0) {
      const sum = this.metrics.history.reduce((a, b) => a + b, 0);
      this.metrics.avgResponseTimeMs = Math.round(sum / this.metrics.history.length);
    }

    this.metrics.successRate = Math.round((this.successes / this.metrics.totalScrapes) * 100);
  }

  getMetrics() {
    return { ...this.metrics };
  }

  async persist(_providerId: string) {
    const key = `metrics:provider:${_providerId}`;
    metricsStore.set(key, this.getMetrics());
  }

  async load(_providerId: string) {
    const key = `metrics:provider:${_providerId}`;
    const data = metricsStore.get(key);
    if (data) {
      this.metrics = { ...this.metrics, ...data };
      this.successes = Math.round((this.metrics.successRate / 100) * this.metrics.totalScrapes);
      this.failures = this.metrics.totalScrapes - this.successes;
    }
  }
}
