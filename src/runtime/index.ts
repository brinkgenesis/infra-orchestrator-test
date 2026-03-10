export interface HealthStatus {
  healthy: boolean;
  service: string;
  latencyMs: number;
  timestamp: number;
  error?: string;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter?: boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
};

export function computeBackoff(attempt: number, opts: RetryOptions = DEFAULT_RETRY): number {
  const delay = opts.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(delay, opts.maxDelayMs);
  if (opts.jitter === true) {
    return Math.floor(capped * Math.random());
  }
  return capped;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = DEFAULT_RETRY,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < opts.maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, computeBackoff(attempt, opts)));
      }
    }
  }
  throw lastError;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(opts: CircuitBreakerOptions) {
    this.failureThreshold = opts.failureThreshold;
    this.resetTimeoutMs = opts.resetTimeoutMs;
  }

  getState(): CircuitState {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.state = 'half-open';
      }
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const current = this.getState();

    if (current === 'open') {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = 0;
  }
}

export interface TimeoutOptions {
  timeoutMs: number;
  message?: string;
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  opts: TimeoutOptions,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(opts.message ?? `Operation timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);

    fn().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export class Bulkhead {
  private running = 0;
  private readonly queue: Array<() => void> = [];
  private readonly maxConcurrent: number;
  private readonly maxQueue: number;

  constructor(maxConcurrent: number, maxQueue = Infinity) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
  }

  getRunning(): number {
    return this.running;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new Error('Bulkhead queue is full');
      }
      await new Promise<void>((resolve, reject) => {
        this.queue.push(() => {
          if (this.running < this.maxConcurrent) {
            resolve();
          } else {
            reject(new Error('Bulkhead capacity exceeded'));
          }
        });
      });
    }

    this.running++;
    try {
      const result = await fn();
      return result;
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next !== undefined) {
        next();
      }
    }
  }
}

export async function checkHealth(
  service: string,
  probe: () => Promise<void>,
): Promise<HealthStatus> {
  const start = Date.now();
  try {
    await probe();
    return {
      healthy: true,
      service,
      latencyMs: Date.now() - start,
      timestamp: start,
    };
  } catch (err) {
    return {
      healthy: false,
      service,
      latencyMs: Date.now() - start,
      timestamp: start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
