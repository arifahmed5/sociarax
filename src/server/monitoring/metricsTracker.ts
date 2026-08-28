export interface RollingMetrics {
  totalRequests: number;
  successfulRequests: number;
  clientErrors: number; // 4xx
  serverErrors: number; // 5xx
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  requestsPerMinute: number;
  errorRatePercent: number;
  uptimeSeconds: number;
  startTime: string;
}

class MetricsTracker {
  private startTime = Date.now();
  private totalRequests = 0;
  private successfulRequests = 0;
  private clientErrors = 0;
  private serverErrors = 0;
  
  // Rolling latency samples (last 1000 requests)
  private latencySamples: number[] = [];
  private readonly maxLatencySamples = 1000;

  // Rolling request timestamps for RPM calculation (last 60 seconds)
  private requestTimestamps: number[] = [];

  public recordRequest(statusCode: number, durationMs: number): void {
    const now = Date.now();
    this.totalRequests++;

    if (statusCode >= 500) {
      this.serverErrors++;
    } else if (statusCode >= 400) {
      this.clientErrors++;
    } else {
      this.successfulRequests++;
    }

    // Record latency
    this.latencySamples.push(Math.round(durationMs));
    if (this.latencySamples.length > this.maxLatencySamples) {
      this.latencySamples.shift();
    }

    // Record timestamp for RPM
    this.requestTimestamps.push(now);
  }

  public getMetrics(): RollingMetrics {
    const now = Date.now();
    
    // Prune timestamps older than 60 seconds
    const oneMinuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    const requestsPerMinute = this.requestTimestamps.length;

    // Calculate latency percentiles
    let avg = 0;
    let p50 = 0;
    let p95 = 0;
    let p99 = 0;

    if (this.latencySamples.length > 0) {
      const sorted = [...this.latencySamples].sort((a, b) => a - b);
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      avg = Math.round(sum / sorted.length);

      const idx50 = Math.floor(sorted.length * 0.5);
      const idx95 = Math.floor(sorted.length * 0.95);
      const idx99 = Math.floor(sorted.length * 0.99);

      p50 = sorted[Math.min(idx50, sorted.length - 1)];
      p95 = sorted[Math.min(idx95, sorted.length - 1)];
      p99 = sorted[Math.min(idx99, sorted.length - 1)];
    }

    const totalTracked = this.totalRequests || 1;
    const errorRate = ((this.serverErrors + this.clientErrors) / totalTracked) * 100;

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      clientErrors: this.clientErrors,
      serverErrors: this.serverErrors,
      averageLatencyMs: avg,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      requestsPerMinute,
      errorRatePercent: parseFloat(errorRate.toFixed(2)),
      uptimeSeconds: Math.floor((now - this.startTime) / 1000),
      startTime: new Date(this.startTime).toISOString()
    };
  }
}

export const metricsTracker = new MetricsTracker();
