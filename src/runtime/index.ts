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
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

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
    // Full jitter with a floor of 1ms to avoid zero-delay retries
    return Math.max(1, Math.floor(capped * Math.random()));
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
  private readonly onStateChange: ((from: CircuitState, to: CircuitState) => void) | undefined;

  /** Initializes the circuit breaker with the given failure threshold and reset timeout. */
  constructor(opts: CircuitBreakerOptions) {
    if (opts.failureThreshold < 1 || !Number.isFinite(opts.failureThreshold)) {
      throw new Error('failureThreshold must be a positive finite integer');
    }
    if (opts.resetTimeoutMs <= 0 || !Number.isFinite(opts.resetTimeoutMs)) {
      throw new Error('resetTimeoutMs must be a positive finite number');
    }
    this.failureThreshold = opts.failureThreshold;
    this.resetTimeoutMs = opts.resetTimeoutMs;
    this.onStateChange = opts.onStateChange;
  }

  private transition(to: CircuitState): void {
    if (this.state !== to) {
      const from = this.state;
      this.state = to;
      this.onStateChange?.(from, to);
    }
  }

  /** Returns the current circuit state, transitioning from open to half-open if the reset timeout has elapsed. */
  getState(): CircuitState {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.transition('half-open');
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
      throw new CircuitBreakerOpenError();
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
    this.transition('closed');
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'half-open' || this.failures >= this.failureThreshold) {
      this.transition('open');
    }
  }

  /** Resets the circuit breaker to its initial closed state, clearing all counters. */
  reset(): void {
    this.transition('closed');
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

/** Error thrown when an operation exceeds its configured timeout. */
export class TimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string) {
    super(message ?? `Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** Error thrown when the circuit breaker is open and rejecting calls. */
export class CircuitBreakerOpenError extends Error {
  constructor(message?: string) {
    super(message ?? 'Circuit breaker is open');
    this.name = 'CircuitBreakerOpenError';
  }
}

/** Error thrown when a bulkhead's queue is full and cannot accept more work. */
export class BulkheadFullError extends Error {
  constructor(message?: string) {
    super(message ?? 'Bulkhead queue is full');
    this.name = 'BulkheadFullError';
  }
}

/** Executes the given async function and rejects with a TimeoutError if it does not complete in time. */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  opts: TimeoutOptions,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(opts.timeoutMs, opts.message));
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
    if (maxConcurrent < 1 || !Number.isFinite(maxConcurrent)) {
      throw new Error('maxConcurrent must be a positive finite integer');
    }
    if (maxQueue < 0) {
      throw new Error('maxQueue must be a non-negative number');
    }
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
        throw new BulkheadFullError();
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
      } else {
        this.notifyDrain();
      }
    }
  }

  private drainResolvers: Array<() => void> = [];

  private notifyDrain(): void {
    if (this.running === 0 && this.queue.length === 0) {
      for (const resolve of this.drainResolvers.splice(0)) {
        resolve();
      }
    }
  }

  /** Returns a promise that resolves when all in-flight and queued tasks have completed. Resolves immediately if idle. */
  async drain(): Promise<void> {
    if (this.running === 0 && this.queue.length === 0) {
      return;
    }
    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
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
    if (opts.maxTokens <= 0 || !Number.isFinite(opts.maxTokens)) {
      throw new Error('maxTokens must be a positive finite number');
    }
    if (opts.refillRate < 0 || !Number.isFinite(opts.refillRate)) {
      throw new Error('refillRate must be a non-negative finite number');
    }
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

  /** Resets the rate limiter to full capacity. */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}

export interface DeadlineOptions {
  timeoutMs: number;
  message?: string;
}

/** Propagates a cancellation deadline across async call chains. */
export class DeadlineContext {
  private readonly deadline: number;
  private readonly message: string;
  private cancelled = false;

  constructor(opts: DeadlineOptions) {
    this.deadline = Date.now() + opts.timeoutMs;
    this.message = opts.message ?? `Deadline exceeded after ${opts.timeoutMs}ms`;
  }

  /** Returns the number of milliseconds remaining before the deadline. */
  remaining(): number {
    return Math.max(0, this.deadline - Date.now());
  }

  /** Returns true if the deadline has passed or the context was manually cancelled. */
  isExpired(): boolean {
    return this.cancelled || Date.now() >= this.deadline;
  }

  /** Manually cancels the context. */
  cancel(): void {
    this.cancelled = true;
  }

  /** Throws if the deadline has expired or the context was cancelled. */
  check(): void {
    if (this.isExpired()) {
      throw new Error(this.message);
    }
  }

  /** Runs the given async function, rejecting if the deadline expires first. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    this.check();
    const rem = this.remaining();
    return withTimeout(fn, { timeoutMs: rem, message: this.message });
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

/** Executes the given async function and returns a fallback value if it throws. */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T | ((err: unknown) => T),
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    return typeof fallback === 'function'
      ? (fallback as (err: unknown) => T)(err)
      : fallback;
  }
}

/** An error subclass that carries a retryable flag and optional retry-after hint. */
export class RetryableError extends Error {
  readonly retryable: boolean;
  readonly retryAfterMs: number | undefined;

  constructor(message: string, opts: { retryable: boolean; retryAfterMs?: number } = { retryable: true }) {
    super(message);
    this.name = 'RetryableError';
    this.retryable = opts.retryable;
    this.retryAfterMs = opts.retryAfterMs ?? undefined;
  }
}

/** Default isRetryable predicate that checks for RetryableError instances. */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof RetryableError) {
    return err.retryable;
  }
  return true;
}

export interface SlidingWindowRateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

/** Sliding-window rate limiter that tracks request timestamps within a rolling window. */
export class SlidingWindowRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private timestamps: number[] = [];

  constructor(opts: SlidingWindowRateLimiterOptions) {
    if (opts.maxRequests < 1 || !Number.isFinite(opts.maxRequests)) {
      throw new Error('maxRequests must be a positive finite integer');
    }
    if (opts.windowMs <= 0 || !Number.isFinite(opts.windowMs)) {
      throw new Error('windowMs must be a positive finite number');
    }
    this.maxRequests = opts.maxRequests;
    this.windowMs = opts.windowMs;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    // Binary search for the first timestamp within the window to avoid O(n) shifts
    let lo = 0;
    let hi = this.timestamps.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.timestamps[mid]! <= cutoff) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    if (lo > 0) {
      this.timestamps = this.timestamps.slice(lo);
    }
  }

  /** Attempts to record a request; returns true if allowed, false if rate-limited. */
  tryAcquire(): boolean {
    const now = Date.now();
    this.prune(now);
    if (this.timestamps.length >= this.maxRequests) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }

  /** Returns the number of requests recorded in the current window. */
  getCount(): number {
    this.prune(Date.now());
    return this.timestamps.length;
  }

  /** Returns the number of remaining requests allowed in the current window. */
  getRemaining(): number {
    return Math.max(0, this.maxRequests - this.getCount());
  }

  /** Resets the sliding window, clearing all recorded timestamps. */
  reset(): void {
    this.timestamps = [];
  }
}

export interface ResiliencePipelineOptions<T> {
  retry?: RetryOptions;
  timeout?: TimeoutOptions;
  circuitBreaker?: CircuitBreakerOptions;
  fallback?: T | ((err: unknown) => T);
}

/**
 * Composes CircuitBreaker, retry, timeout, and fallback into a single
 * reusable execution pipeline. Strategies are applied in the correct order:
 *   fallback( circuitBreaker( retry( timeout( fn ) ) ) )
 */
export class ResiliencePipeline<T> {
  private readonly cb: CircuitBreaker | undefined;
  private readonly retryOpts: RetryOptions | undefined;
  private readonly timeoutOpts: TimeoutOptions | undefined;
  private readonly fallbackValue: T | ((err: unknown) => T) | undefined;
  private readonly hasFallback: boolean;

  constructor(opts: ResiliencePipelineOptions<T>) {
    this.cb = opts.circuitBreaker ? new CircuitBreaker(opts.circuitBreaker) : undefined;
    this.retryOpts = opts.retry ?? undefined;
    this.timeoutOpts = opts.timeout ?? undefined;
    this.fallbackValue = opts.fallback ?? undefined;
    this.hasFallback = 'fallback' in opts;
  }

  /** Returns the underlying CircuitBreaker instance, if configured. */
  getCircuitBreaker(): CircuitBreaker | undefined {
    return this.cb;
  }

  /** Executes the given function through the full resilience pipeline. */
  async execute(fn: () => Promise<T>): Promise<T> {
    let wrapped: () => Promise<T> = fn;

    if (this.timeoutOpts) {
      const tOpts = this.timeoutOpts;
      const inner = wrapped;
      wrapped = () => withTimeout(inner, tOpts);
    }

    if (this.retryOpts) {
      const rOpts = this.retryOpts;
      const inner = wrapped;
      wrapped = () => withRetry(inner, rOpts);
    }

    if (this.cb) {
      const cb = this.cb;
      const inner = wrapped;
      wrapped = () => cb.execute(inner);
    }

    if (this.hasFallback) {
      return withFallback(wrapped, this.fallbackValue as T | ((err: unknown) => T));
    }

    return wrapped();
  }
}

export interface HedgingOptions {
  delayMs: number;
  maxAttempts?: number;
}

/**
 * Hedged requests: launches the primary call immediately and, if it hasn't
 * resolved after `delayMs`, fires a secondary (hedged) attempt. Returns
 * whichever resolves first. If all attempts fail, throws the last error.
 */
export async function withHedging<T>(
  fn: () => Promise<T>,
  opts: HedgingOptions,
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 2;
  if (maxAttempts < 1) {
    throw new Error('maxAttempts must be at least 1');
  }
  if (maxAttempts === 1) {
    return fn();
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let pending = 0;
    let lastError: unknown;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const attempt = () => {
      pending++;
      fn().then(
        (result) => {
          if (!settled) {
            settled = true;
            for (const t of timers) clearTimeout(t);
            resolve(result);
          }
        },
        (err) => {
          lastError = err;
          pending--;
          if (pending === 0 && !settled) {
            settled = true;
            for (const t of timers) clearTimeout(t);
            reject(lastError);
          }
        },
      );
    };

    // Launch the primary attempt immediately
    attempt();

    // Schedule hedged attempts
    for (let i = 1; i < maxAttempts; i++) {
      const timer = setTimeout(() => {
        if (!settled) {
          attempt();
        }
      }, opts.delayMs * i);
      timers.push(timer);
    }
  });
}
