import { logEvent } from './logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // consecutive failures before opening circuit
  cooldownPeriodMs: number; // time to wait before entering HALF_OPEN state
  successThreshold: number; // successful calls in HALF_OPEN before closing circuit
  timeoutMs: number; // max execution time before marking as failure
}

export interface CircuitStatus {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastStateChange: string;
  totalExecutions: number;
  totalTrips: number;
}

export class CircuitBreaker {
  public name: string;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastStateChange: string = new Date().toISOString();
  private totalExecutions = 0;
  private totalTrips = 0;
  private config: CircuitBreakerConfig;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = {
      failureThreshold: 5,
      cooldownPeriodMs: 30000, // 30 seconds
      successThreshold: 2,
      timeoutMs: 10000, // 10 seconds
      ...config
    };
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN' && this.lastFailureTime) {
      if (Date.now() - this.lastFailureTime >= this.config.cooldownPeriodMs) {
        this.transitionTo('HALF_OPEN');
      }
    }
    return this.state;
  }

  public getStatus(): CircuitStatus {
    return {
      name: this.name,
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      totalExecutions: this.totalExecutions,
      totalTrips: this.totalTrips
    };
  }

  public reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.transitionTo('CLOSED');
    logEvent('INFO', 'CIRCUIT_BREAKER', `Circuit breaker [${this.name}] was manually reset to CLOSED.`);
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date().toISOString();
    
    if (newState === 'OPEN') {
      this.totalTrips++;
      logEvent('WARNING', 'CIRCUIT_BREAKER', `Circuit breaker [${this.name}] TRIPPED from ${oldState} to OPEN. Threshold of ${this.config.failureThreshold} failures reached. Fast-failing calls for ${this.config.cooldownPeriodMs / 1000}s.`);
    } else if (newState === 'HALF_OPEN') {
      logEvent('INFO', 'CIRCUIT_BREAKER', `Circuit breaker [${this.name}] entered HALF_OPEN state. Testing upstream health.`);
    } else if (newState === 'CLOSED' && oldState !== 'CLOSED') {
      logEvent('INFO', 'CIRCUIT_BREAKER', `Circuit breaker [${this.name}] recovered and CLOSED. Normal operations restored.`);
    }
  }

  public async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    this.totalExecutions++;
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      if (fallback) {
        return fallback();
      }
      throw new Error(`Service [${this.name}] is temporarily paused by circuit breaker to protect system integrity.`);
    }

    let timeoutHandle: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Operation for [${this.name}] timed out after ${this.config.timeoutMs}ms.`));
      }, this.config.timeoutMs);
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      clearTimeout(timeoutHandle);
      this.onSuccess();
      return result;
    } catch (err: any) {
      clearTimeout(timeoutHandle);
      this.onFailure(err);
      if (fallback) {
        return fallback();
      }
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.failureCount = 0;
        this.successCount = 0;
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  private onFailure(error: any): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    logEvent('WARNING', 'CIRCUIT_BREAKER', `Circuit [${this.name}] recorded failure #${this.failureCount}: ${error?.message || error}`);

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }
}

// Registry for all system circuit breakers
export const circuitRegistry = {
  dbPool: new CircuitBreaker('database_pool', { failureThreshold: 4, cooldownPeriodMs: 20000 }),
  smmProviders: new CircuitBreaker('smm_providers', { failureThreshold: 5, cooldownPeriodMs: 45000 }),
  authService: new CircuitBreaker('auth_service', { failureThreshold: 6, cooldownPeriodMs: 30000 }),
  backgroundWorker: new CircuitBreaker('background_worker', { failureThreshold: 3, cooldownPeriodMs: 60000 })
};
