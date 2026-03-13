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

export function computeBackoff(
  attempt: number,
  opts: RetryOptions = DEFAULT_RETRY,
  jitter = false,
): number {
  const delay = opts.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(delay, opts.maxDelayMs);
  if (!jitter) return capped;
  // Full jitter: uniform random in [0, capped] to prevent thundering herd
  return Math.floor(Math.random() * (capped + 1));
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
): Promise<T> {
  if (ms <= 0) throw new RangeError('Timeout must be positive');
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = DEFAULT_RETRY,
): Promise<T> {
  if (opts.maxAttempts < 1) {
    throw new Error('maxAttempts must be at least 1');
  }
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
    if (opts.failureThreshold < 1 || !Number.isFinite(opts.failureThreshold)) {
      throw new Error('failureThreshold must be a positive finite integer');
    }
    if (opts.resetTimeoutMs <= 0 || !Number.isFinite(opts.resetTimeoutMs)) {
      throw new Error('resetTimeoutMs must be a positive finite number');
    }
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
    if (this.state === 'half-open' || this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = 0;
  }
}

// Runtime type guards and assertion helpers

export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

export function assertNonNullable<T>(
  value: T,
  label?: string,
): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(`Expected non-nullable value${label ? ` for ${label}` : ''}, got ${String(value)}`);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertType<T>(
  value: unknown,
  guard: (v: unknown) => v is T,
  label?: string,
): asserts value is T {
  if (!guard(value)) {
    throw new TypeError(`Type assertion failed${label ? ` for ${label}` : ''}`);
  }
}

export function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled case: ${String(value)}`);
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
