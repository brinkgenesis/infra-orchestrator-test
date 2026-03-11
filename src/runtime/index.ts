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
  isRetryable?: (err: unknown) => boolean;
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

/** Computes the exponential backoff delay (in ms) for a given attempt number, with optional jitter. */
export function computeBackoff(attempt: number, opts: RetryOptions = DEFAULT_RETRY): number {
  const delay = opts.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(delay, opts.maxDelayMs);
  if (opts.jitter === true) {
    return Math.floor(capped * Math.random());
  }
  return capped;
}

/** Executes the given async function with automatic retries according to the provided options. */
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
      if (opts.isRetryable && !opts.isRetryable(err)) {
        throw err;
      }
      if (attempt < opts.maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, computeBackoff(attempt, opts)));
      }
    }
  }
  throw lastError;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime: number;
}

/** Implements the circuit-breaker pattern to stop cascading failures in async operations. */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  /** Initializes the circuit breaker with the given failure threshold and reset timeout. */
  constructor(opts: CircuitBreakerOptions) {
    this.failureThreshold = opts.failureThreshold;
    this.resetTimeoutMs = opts.resetTimeoutMs;
  }

  /** Returns the current circuit state, transitioning from open to half-open if the reset timeout has elapsed. */
  getState(): CircuitState {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.state = 'half-open';
      }
    }
    return this.state;
  }

  /** Returns a snapshot of the circuit breaker's current metrics. */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /** Executes the given function through the circuit breaker, throwing if the circuit is open. */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const current = this.getState();

    if (current === 'open') {
      throw new Error('Circuit breaker is open');
    }

    this.totalRequests++;
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
    this.successes++;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'half-open' || this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  /** Resets the circuit breaker to its initial closed state, clearing all counters. */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.lastFailureTime = 0;
  }
}

export interface TimeoutOptions {
  timeoutMs: number;
  message?: string;
}

/** Executes the given async function and rejects with a timeout error if it does not complete in time. */
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

/** Executes the given function with both retry and per-attempt timeout semantics applied. */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  retryOpts: RetryOptions,
  timeoutOpts: TimeoutOptions,
): Promise<T> {
  return withRetry(() => withTimeout(fn, timeoutOpts), retryOpts);
}

/** Limits the number of concurrent async executions and optionally queues excess requests. */
export class Bulkhead {
  private running = 0;
  private readonly queue: Array<() => void> = [];
  private readonly maxConcurrent: number;
  private readonly maxQueue: number;

  /** Initializes the bulkhead with the given concurrency limit and optional queue depth. */
  constructor(maxConcurrent: number, maxQueue = Infinity) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
  }

  /** Returns the number of currently running executions. */
  getRunning(): number {
    return this.running;
  }

  /** Returns the number of requests waiting in the queue. */
  getQueueLength(): number {
    return this.queue.length;
  }

  /** Executes the given function within the bulkhead, queuing if at capacity or throwing if the queue is full. */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new Error('Bulkhead queue is full');
      }
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
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

export interface RateLimiterOptions {
  maxTokens: number;
  refillRate: number;
}

/** Token-bucket rate limiter that refills at a configurable rate per second. */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private lastRefill: number;

  /** Initializes the rate limiter with the given max token capacity and refill rate. */
  constructor(opts: RateLimiterOptions) {
    this.maxTokens = opts.maxTokens;
    this.refillRate = opts.refillRate;
    this.tokens = opts.maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = (elapsed / 1000) * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  /** Returns the current available token count after performing a refill. */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  /** Attempts to acquire the specified number of tokens without blocking; returns false if unavailable. */
  tryAcquire(count = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  /** Waits until the specified number of tokens are available and then acquires them. */
  async acquire(count = 1): Promise<void> {
    if (this.refillRate <= 0) {
      throw new Error('Cannot acquire: refillRate must be greater than 0');
    }
    while (!this.tryAcquire(count)) {
      const deficit = count - this.tokens;
      const waitMs = Math.max(1, (deficit / this.refillRate) * 1000);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

export type ShutdownHandler = () => Promise<void> | void;

/** Manages ordered shutdown of registered async handlers with an overall timeout guard. */
export class GracefulShutdown {
  private handlers: Array<{ name: string; handler: ShutdownHandler }> = [];
  private isShuttingDown = false;

  /** Registers a named shutdown handler to be called during graceful shutdown. */
  register(name: string, handler: ShutdownHandler): void {
    this.handlers.push({ name, handler });
  }

  /** Removes the shutdown handler with the given name. */
  unregister(name: string): void {
    this.handlers = this.handlers.filter((h) => h.name !== name);
  }

  /** Returns true if a shutdown sequence is currently in progress. */
  getIsShuttingDown(): boolean {
    return this.isShuttingDown;
  }

  /** Runs all registered handlers in reverse order and returns success/error results, subject to the given timeout. */
  async shutdown(timeoutMs = 10000): Promise<{ success: boolean; errors: Array<{ name: string; error: string }> }> {
    if (this.isShuttingDown) {
      return { success: false, errors: [{ name: 'shutdown', error: 'Shutdown already in progress' }] };
    }
    this.isShuttingDown = true;
    const errors: Array<{ name: string; error: string }> = [];

    const shutdownPromise = (async () => {
      for (const { name, handler } of [...this.handlers].reverse()) {
        try {
          await handler();
        } catch (err) {
          errors.push({ name, error: err instanceof Error ? err.message : String(err) });
        }
      }
    })();

    const result = await Promise.race([
      shutdownPromise.then(() => 'done' as const),
      new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), timeoutMs)),
    ]);

    if (result === 'timeout') {
      errors.push({ name: 'shutdown', error: `Shutdown timed out after ${timeoutMs}ms` });
    }

    return { success: errors.length === 0, errors };
  }

  /** Clears all handlers and resets the shutdown state. */
  reset(): void {
    this.handlers = [];
    this.isShuttingDown = false;
  }
}

/** Runs a health probe for the named service and returns a HealthStatus with latency and error info. */
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

export interface AggregateHealthStatus {
  healthy: boolean;
  services: HealthStatus[];
  totalLatencyMs: number;
}

/** Runs all provided health probes concurrently and returns an aggregated health status. */
export async function aggregateHealth(
  checks: Array<{ service: string; probe: () => Promise<void> }>,
): Promise<AggregateHealthStatus> {
  const start = Date.now();
  const services = await Promise.all(
    checks.map(({ service, probe }) => checkHealth(service, probe)),
  );
  return {
    healthy: services.every((s) => s.healthy),
    services,
    totalLatencyMs: Date.now() - start,
  };
}
