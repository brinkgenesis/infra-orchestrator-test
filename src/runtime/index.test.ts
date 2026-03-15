import { describe, it, expect, vi } from 'vitest';
import {
  computeBackoff,
  withRetry,
  withRetryAndTimeout,
  CircuitBreaker,
  checkHealth,
  aggregateHealth,
  withTimeout,
  Bulkhead,
  RateLimiter,
  GracefulShutdown,
  DeadlineContext,
  withFallback,
  RetryableError,
  isRetryableError,
  SlidingWindowRateLimiter,
  ResiliencePipeline,
  TimeoutError,
  CircuitBreakerOpenError,
  BulkheadFullError,
  withHedging,
  RetryBudget,
  FallbackChain,
  AdaptiveConcurrencyLimiter,
  PeriodicTask,
  Semaphore,
  ReadinessGate,
  ResourcePool,
  DependencyChecker,
} from './index';
import type { CircuitState } from './index';

describe('computeBackoff', () => {
  it('returns exponentially increasing delays', () => {
    expect(computeBackoff(0)).toBe(100);
    expect(computeBackoff(1)).toBe(200);
    expect(computeBackoff(2)).toBe(400);
  });

  it('caps at maxDelayMs', () => {
    expect(computeBackoff(20)).toBe(5000);
  });

  it('respects custom options', () => {
    const opts = { maxAttempts: 5, baseDelayMs: 50, maxDelayMs: 1000 };
    expect(computeBackoff(0, opts)).toBe(50);
    expect(computeBackoff(5, opts)).toBe(1000);
  });

  it('applies jitter when enabled', () => {
    const opts = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000, jitter: true as const };
    const results = Array.from({ length: 20 }, () => computeBackoff(2, opts));
    const base = 100 * Math.pow(2, 2); // 400
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(base);
    }
    // With 20 samples, not all should be identical (probabilistic but safe)
    const unique = new Set(results);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('withRetry', () => {
  it('returns on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(
      withRetry(fn, { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('works with jitter enabled', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 10,
      jitter: true,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately for non-retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('auth failed'))
      .mockResolvedValue('ok');
    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 10,
        isRetryable: (err) => err instanceof Error && err.message !== 'auth failed',
      }),
    ).rejects.toThrow('auth failed');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retryable errors and stops on non-retryable', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('fatal'));
    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        baseDelayMs: 1,
        maxDelayMs: 10,
        isRetryable: (err) => err instanceof Error && err.message === 'timeout',
      }),
    ).rejects.toThrow('fatal');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws if maxAttempts is less than 1', async () => {
    await expect(
      withRetry(() => Promise.resolve('ok'), { maxAttempts: 0, baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('maxAttempts must be at least 1');
  });

  it('respects RetryableError.retryAfterMs hint for delay', async () => {
    const start = Date.now();
    const fn = vi.fn()
      .mockRejectedValueOnce(new RetryableError('rate limited', { retryable: true, retryAfterMs: 50 }))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    const elapsed = Date.now() - start;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    // Should have waited ~50ms (the retryAfterMs hint), not 1ms (the baseDelayMs)
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it('uses normal backoff for non-RetryableError errors', async () => {
    const start = Date.now();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('generic'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    const elapsed = Date.now() - start;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    // Should be fast since baseDelayMs is 1
    expect(elapsed).toBeLessThan(40);
  });
});

describe('withRetryAndTimeout', () => {
  it('succeeds when fn resolves within timeout and retries', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetryAndTimeout(
      fn,
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 },
      { timeoutMs: 100 },
    );
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on timeout and eventually succeeds', async () => {
    let call = 0;
    const fn = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) return new Promise((r) => setTimeout(r, 200));
      return Promise.resolve('recovered');
    });
    const result = await withRetryAndTimeout(
      fn,
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 },
      { timeoutMs: 20 },
    );
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('CircuitBreaker', () => {
  it('starts in closed state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    expect(cb.getState()).toBe('closed');
  });

  it('opens after reaching failure threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });
    const fail = () => Promise.reject(new Error('fail'));

    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getState()).toBe('closed');

    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getState()).toBe('open');
  });

  it('rejects calls when open with CircuitBreakerOpenError', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    const err = await cb.execute(() => Promise.resolve('ok')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CircuitBreakerOpenError);
    expect((err as CircuitBreakerOpenError).message).toBe('Circuit breaker is open');
  });

  it('transitions to half-open after timeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState()).toBe('half-open');
  });

  it('re-opens immediately on first failure in half-open state', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 50 });
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    }
    expect(cb.getState()).toBe('open');

    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState()).toBe('half-open');

    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getState()).toBe('open');
  });

  it('closes again after success in half-open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();

    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState()).toBe('half-open');

    const result = await cb.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('closed');
  });

  it('tracks metrics across executions', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    const metrics0 = cb.getMetrics();
    expect(metrics0.state).toBe('closed');
    expect(metrics0.totalRequests).toBe(0);
    expect(metrics0.successes).toBe(0);
    expect(metrics0.failures).toBe(0);

    await cb.execute(() => Promise.resolve('ok'));
    await cb.execute(() => Promise.resolve('ok'));
    const metrics1 = cb.getMetrics();
    expect(metrics1.totalRequests).toBe(2);
    expect(metrics1.successes).toBe(2);
    expect(metrics1.failures).toBe(0);

    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    const metrics2 = cb.getMetrics();
    expect(metrics2.totalRequests).toBe(3);
    expect(metrics2.successes).toBe(2);
    expect(metrics2.failures).toBe(1);
    expect(metrics2.lastFailureTime).toBeGreaterThan(0);
  });

  it('resets to closed state via reset()', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    cb.reset();
    expect(cb.getState()).toBe('closed');

    const result = await cb.execute(() => Promise.resolve('after reset'));
    expect(result).toBe('after reset');
  });
});

describe('withTimeout', () => {
  it('resolves if operation completes within timeout', async () => {
    const result = await withTimeout(() => Promise.resolve('fast'), { timeoutMs: 100 });
    expect(result).toBe('fast');
  });

  it('rejects with TimeoutError if operation exceeds timeout', async () => {
    const err = await withTimeout(
      () => new Promise((r) => setTimeout(r, 200)),
      { timeoutMs: 10 },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect((err as TimeoutError).timeoutMs).toBe(10);
    expect((err as TimeoutError).message).toBe('Operation timed out after 10ms');
  });

  it('uses custom timeout message', async () => {
    await expect(
      withTimeout(
        () => new Promise((r) => setTimeout(r, 200)),
        { timeoutMs: 10, message: 'custom timeout' },
      ),
    ).rejects.toThrow('custom timeout');
  });

  it('propagates the original error if fn rejects before timeout', async () => {
    await expect(
      withTimeout(
        () => Promise.reject(new Error('fn error')),
        { timeoutMs: 1000 },
      ),
    ).rejects.toThrow('fn error');
  });
});

describe('Bulkhead', () => {
  it('allows execution under concurrency limit', async () => {
    const bh = new Bulkhead(2);
    const result = await bh.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(bh.getRunning()).toBe(0);
  });

  it('rejects with BulkheadFullError when queue is full', async () => {
    const bh = new Bulkhead(1, 0);
    const blocker = new Promise<string>((resolve) => {
      setTimeout(() => resolve('done'), 100);
    });
    const first = bh.execute(() => blocker);

    const err = await bh.execute(() => Promise.resolve('x')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BulkheadFullError);
    expect((err as BulkheadFullError).message).toBe('Bulkhead queue is full');
    await first;
  });

  it('queues and processes tasks sequentially when at capacity', async () => {
    const bh = new Bulkhead(1, 10);
    const order: number[] = [];

    const task = (id: number, ms: number) =>
      bh.execute(
        () =>
          new Promise<void>((resolve) => {
            order.push(id);
            setTimeout(resolve, ms);
          }),
      );

    await Promise.all([task(1, 10), task(2, 10)]);
    expect(order).toEqual([1, 2]);
    expect(bh.getRunning()).toBe(0);
    expect(bh.getQueueLength()).toBe(0);
  });

  it('drain() resolves immediately when idle', async () => {
    const bh = new Bulkhead(2);
    await bh.drain(); // should not hang
  });

  it('drain() waits for in-flight tasks to complete', async () => {
    const bh = new Bulkhead(2);
    let finished = false;

    bh.execute(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            finished = true;
            resolve();
          }, 30);
        }),
    );

    await bh.drain();
    expect(finished).toBe(true);
    expect(bh.getRunning()).toBe(0);
  });

  it('drain() waits for queued tasks too', async () => {
    const bh = new Bulkhead(1, 10);
    const order: number[] = [];

    const t1 = bh.execute(() => new Promise<void>((r) => { setTimeout(() => { order.push(1); r(); }, 10); }));
    const t2 = bh.execute(() => new Promise<void>((r) => { setTimeout(() => { order.push(2); r(); }, 10); }));

    // Ensure both tasks are tracked before draining
    expect(bh.getQueueLength()).toBe(1);

    await bh.drain();
    expect(order).toEqual([1, 2]);
    expect(bh.getRunning()).toBe(0);
    expect(bh.getQueueLength()).toBe(0);

    // Clean up floating promises
    await Promise.all([t1, t2]);
  });
});

describe('RateLimiter', () => {
  it('starts with full token bucket', () => {
    const rl = new RateLimiter({ maxTokens: 10, refillRate: 5 });
    expect(rl.getTokens()).toBeCloseTo(10, 0);
  });

  it('tryAcquire succeeds when tokens available', () => {
    const rl = new RateLimiter({ maxTokens: 5, refillRate: 10 });
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire(3)).toBe(true);
    expect(rl.getTokens()).toBeCloseTo(1, 0);
  });

  it('tryAcquire fails when insufficient tokens', () => {
    const rl = new RateLimiter({ maxTokens: 2, refillRate: 1 });
    expect(rl.tryAcquire(3)).toBe(false);
    expect(rl.getTokens()).toBeCloseTo(2, 0);
  });

  it('acquire waits and then succeeds', async () => {
    const rl = new RateLimiter({ maxTokens: 1, refillRate: 100 });
    rl.tryAcquire(1); // drain tokens
    const start = Date.now();
    await rl.acquire(1);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(5);
  });

  it('acquire handles concurrent callers without going negative', async () => {
    const rl = new RateLimiter({ maxTokens: 2, refillRate: 100 });
    rl.tryAcquire(2); // drain tokens
    const results = await Promise.all([rl.acquire(1), rl.acquire(1)]);
    expect(results).toHaveLength(2);
    expect(rl.getTokens()).toBeGreaterThanOrEqual(0);
  });

  it('does not exceed maxTokens after refill', async () => {
    const rl = new RateLimiter({ maxTokens: 5, refillRate: 1000 });
    await new Promise((r) => setTimeout(r, 50));
    expect(rl.getTokens()).toBeLessThanOrEqual(5);
  });

  it('reset() restores tokens to full capacity', () => {
    const rl = new RateLimiter({ maxTokens: 10, refillRate: 1 });
    rl.tryAcquire(8);
    expect(rl.getTokens()).toBeCloseTo(2, 0);
    rl.reset();
    expect(rl.getTokens()).toBeCloseTo(10, 0);
  });

  it('reset() allows acquire after draining', () => {
    const rl = new RateLimiter({ maxTokens: 3, refillRate: 0 });
    expect(rl.tryAcquire(3)).toBe(true);
    expect(rl.tryAcquire(1)).toBe(false);
    rl.reset();
    expect(rl.tryAcquire(3)).toBe(true);
  });
});

describe('checkHealth', () => {
  it('returns healthy status on success', async () => {
    const status = await checkHealth('test-svc', async () => {});
    expect(status.healthy).toBe(true);
    expect(status.service).toBe('test-svc');
    expect(status.latencyMs).toBeGreaterThanOrEqual(0);
    expect(status.error).toBeUndefined();
  });

  it('returns unhealthy status on failure', async () => {
    const status = await checkHealth('broken-svc', async () => {
      throw new Error('connection refused');
    });
    expect(status.healthy).toBe(false);
    expect(status.service).toBe('broken-svc');
    expect(status.error).toBe('connection refused');
  });

  it('handles non-Error thrown values', async () => {
    const status = await checkHealth('string-err', async () => {
      throw 'raw string error';
    });
    expect(status.healthy).toBe(false);
    expect(status.error).toBe('raw string error');
  });

  it('measures latency accurately', async () => {
    const status = await checkHealth('slow-svc', async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(status.healthy).toBe(true);
    expect(status.latencyMs).toBeGreaterThanOrEqual(15);
  });
});

describe('aggregateHealth', () => {
  it('reports all healthy when all probes pass', async () => {
    const result = await aggregateHealth([
      { service: 'db', probe: async () => {} },
      { service: 'cache', probe: async () => {} },
    ]);
    expect(result.healthy).toBe(true);
    expect(result.services).toHaveLength(2);
    expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports unhealthy when any probe fails', async () => {
    const result = await aggregateHealth([
      { service: 'db', probe: async () => {} },
      { service: 'cache', probe: async () => { throw new Error('down'); } },
    ]);
    expect(result.healthy).toBe(false);
    expect(result.services[1]!.healthy).toBe(false);
    expect(result.services[1]!.error).toBe('down');
  });

  it('returns empty services for empty input', async () => {
    const result = await aggregateHealth([]);
    expect(result.healthy).toBe(true);
    expect(result.services).toHaveLength(0);
  });
});

describe('GracefulShutdown', () => {
  it('starts not shutting down', () => {
    const gs = new GracefulShutdown();
    expect(gs.getIsShuttingDown()).toBe(false);
  });

  it('runs registered handlers in reverse order', async () => {
    const gs = new GracefulShutdown();
    const order: string[] = [];
    gs.register('first', () => { order.push('first'); });
    gs.register('second', () => { order.push('second'); });
    gs.register('third', () => { order.push('third'); });

    const result = await gs.shutdown();
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(order).toEqual(['third', 'second', 'first']);
  });

  it('collects errors from failing handlers', async () => {
    const gs = new GracefulShutdown();
    gs.register('good', () => {});
    gs.register('bad', () => { throw new Error('cleanup failed'); });

    const result = await gs.shutdown();
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.name).toBe('bad');
    expect(result.errors[0]!.error).toBe('cleanup failed');
  });

  it('prevents double shutdown', async () => {
    const gs = new GracefulShutdown();
    gs.register('slow', () => new Promise((r) => setTimeout(r, 50)));

    const first = gs.shutdown();
    const second = await gs.shutdown();
    expect(second.success).toBe(false);
    expect(second.errors[0]!.error).toBe('Shutdown already in progress');
    await first;
  });

  it('unregisters handlers by name', async () => {
    const gs = new GracefulShutdown();
    const called: string[] = [];
    gs.register('keep', () => { called.push('keep'); });
    gs.register('remove', () => { called.push('remove'); });
    gs.unregister('remove');

    await gs.shutdown();
    expect(called).toEqual(['keep']);
  });

  it('resets state completely', async () => {
    const gs = new GracefulShutdown();
    gs.register('handler', () => {});
    await gs.shutdown();
    expect(gs.getIsShuttingDown()).toBe(true);

    gs.reset();
    expect(gs.getIsShuttingDown()).toBe(false);

    const result = await gs.shutdown();
    expect(result.success).toBe(true);
  });

  it('times out if handlers take too long', async () => {
    const gs = new GracefulShutdown();
    gs.register('slow', () => new Promise((r) => setTimeout(r, 5000)));

    const result = await gs.shutdown(50);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.error.includes('timed out'))).toBe(true);
  });

  it('handles async shutdown handlers', async () => {
    const gs = new GracefulShutdown();
    let cleaned = false;
    gs.register('async-cleanup', async () => {
      await new Promise((r) => setTimeout(r, 10));
      cleaned = true;
    });

    const result = await gs.shutdown();
    expect(result.success).toBe(true);
    expect(cleaned).toBe(true);
  });
});

describe('aggregateHealth', () => {
  it('reports healthy when all services pass', async () => {
    const result = await aggregateHealth([
      { service: 'db', probe: async () => {} },
      { service: 'cache', probe: async () => {} },
    ]);
    expect(result.healthy).toBe(true);
    expect(result.services).toHaveLength(2);
    expect(result.services.every((s) => s.healthy)).toBe(true);
    expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports unhealthy when any service fails', async () => {
    const result = await aggregateHealth([
      { service: 'db', probe: async () => {} },
      { service: 'cache', probe: async () => { throw new Error('down'); } },
    ]);
    expect(result.healthy).toBe(false);
    expect(result.services[0]!.healthy).toBe(true);
    expect(result.services[1]!.healthy).toBe(false);
    expect(result.services[1]!.error).toBe('down');
  });

  it('handles empty checks array', async () => {
    const result = await aggregateHealth([]);
    expect(result.healthy).toBe(true);
    expect(result.services).toHaveLength(0);
  });

  it('runs probes concurrently', async () => {
    const start = Date.now();
    await aggregateHealth([
      { service: 'a', probe: () => new Promise<void>((r) => setTimeout(r, 20)) },
      { service: 'b', probe: () => new Promise<void>((r) => setTimeout(r, 20)) },
    ]);
    const elapsed = Date.now() - start;
    // Both run in parallel, so total should be ~20ms not ~40ms
    expect(elapsed).toBeLessThan(35);
  });
});

describe('DeadlineContext', () => {
  it('starts with positive remaining time', () => {
    const ctx = new DeadlineContext({ timeoutMs: 1000 });
    expect(ctx.remaining()).toBeGreaterThan(0);
    expect(ctx.isExpired()).toBe(false);
  });

  it('check() does not throw before deadline', () => {
    const ctx = new DeadlineContext({ timeoutMs: 1000 });
    expect(() => ctx.check()).not.toThrow();
  });

  it('expires after timeout', async () => {
    const ctx = new DeadlineContext({ timeoutMs: 10 });
    await new Promise((r) => setTimeout(r, 20));
    expect(ctx.isExpired()).toBe(true);
    expect(ctx.remaining()).toBe(0);
    expect(() => ctx.check()).toThrow('Deadline exceeded after 10ms');
  });

  it('can be manually cancelled', () => {
    const ctx = new DeadlineContext({ timeoutMs: 10000 });
    expect(ctx.isExpired()).toBe(false);
    ctx.cancel();
    expect(ctx.isExpired()).toBe(true);
  });

  it('uses custom message', async () => {
    const ctx = new DeadlineContext({ timeoutMs: 10, message: 'custom deadline' });
    await new Promise((r) => setTimeout(r, 20));
    expect(() => ctx.check()).toThrow('custom deadline');
  });

  it('run() resolves if fn completes before deadline', async () => {
    const ctx = new DeadlineContext({ timeoutMs: 1000 });
    const result = await ctx.run(() => Promise.resolve('done'));
    expect(result).toBe('done');
  });

  it('run() rejects if fn exceeds deadline', async () => {
    const ctx = new DeadlineContext({ timeoutMs: 10 });
    await expect(
      ctx.run(() => new Promise((r) => setTimeout(r, 200))),
    ).rejects.toThrow('Deadline exceeded');
  });

  it('run() rejects immediately if already expired', async () => {
    const ctx = new DeadlineContext({ timeoutMs: 10 });
    await new Promise((r) => setTimeout(r, 20));
    await expect(
      ctx.run(() => Promise.resolve('late')),
    ).rejects.toThrow('Deadline exceeded');
  });

  it('run() rejects immediately if cancelled', async () => {
    const ctx = new DeadlineContext({ timeoutMs: 10000 });
    ctx.cancel();
    await expect(
      ctx.run(() => Promise.resolve('cancelled')),
    ).rejects.toThrow();
  });

  it('supports sequential runs sharing the same deadline', async () => {
    const ctx = new DeadlineContext({ timeoutMs: 200 });
    const r1 = await ctx.run(() => Promise.resolve('a'));
    const r2 = await ctx.run(() => Promise.resolve('b'));
    expect(r1).toBe('a');
    expect(r2).toBe('b');
    expect(ctx.remaining()).toBeGreaterThan(0);
  });
});

describe('withRetry edge cases', () => {
  it('throws if maxAttempts is 0', async () => {
    await expect(
      withRetry(() => Promise.resolve('ok'), { maxAttempts: 0, baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('maxAttempts must be at least 1');
  });

  it('throws if maxAttempts is negative', async () => {
    await expect(
      withRetry(() => Promise.resolve('ok'), { maxAttempts: -1, baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('maxAttempts must be at least 1');
  });

  it('skips non-retryable errors via isRetryable', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fatal'))
      .mockResolvedValue('ok');
    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 10,
        isRetryable: (err) => err instanceof Error && err.message !== 'fatal',
      }),
    ).rejects.toThrow('fatal');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('RateLimiter edge cases', () => {
  it('acquire throws if refillRate is 0', async () => {
    const rl = new RateLimiter({ maxTokens: 1, refillRate: 0 });
    rl.tryAcquire(1);
    await expect(rl.acquire(1)).rejects.toThrow('refillRate must be greater than 0');
  });

  it('constructor throws for negative maxTokens', () => {
    expect(() => new RateLimiter({ maxTokens: -1, refillRate: 1 })).toThrow(
      'maxTokens must be a positive finite number',
    );
  });

  it('constructor throws for zero maxTokens', () => {
    expect(() => new RateLimiter({ maxTokens: 0, refillRate: 1 })).toThrow(
      'maxTokens must be a positive finite number',
    );
  });

  it('constructor throws for non-finite maxTokens', () => {
    expect(() => new RateLimiter({ maxTokens: Infinity, refillRate: 1 })).toThrow(
      'maxTokens must be a positive finite number',
    );
  });

  it('constructor throws for negative refillRate', () => {
    expect(() => new RateLimiter({ maxTokens: 10, refillRate: -5 })).toThrow(
      'refillRate must be a non-negative finite number',
    );
  });

  it('constructor throws for non-finite refillRate', () => {
    expect(() => new RateLimiter({ maxTokens: 10, refillRate: Infinity })).toThrow(
      'refillRate must be a non-negative finite number',
    );
  });
});

describe('CircuitBreaker constructor validation', () => {
  it('throws for zero failureThreshold', () => {
    expect(() => new CircuitBreaker({ failureThreshold: 0, resetTimeoutMs: 1000 })).toThrow(
      'failureThreshold must be a positive finite integer',
    );
  });

  it('throws for negative failureThreshold', () => {
    expect(() => new CircuitBreaker({ failureThreshold: -1, resetTimeoutMs: 1000 })).toThrow(
      'failureThreshold must be a positive finite integer',
    );
  });

  it('throws for non-finite failureThreshold', () => {
    expect(() => new CircuitBreaker({ failureThreshold: Infinity, resetTimeoutMs: 1000 })).toThrow(
      'failureThreshold must be a positive finite integer',
    );
  });

  it('throws for zero resetTimeoutMs', () => {
    expect(() => new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 0 })).toThrow(
      'resetTimeoutMs must be a positive finite number',
    );
  });

  it('throws for negative resetTimeoutMs', () => {
    expect(() => new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: -100 })).toThrow(
      'resetTimeoutMs must be a positive finite number',
    );
  });
});

describe('Bulkhead constructor validation', () => {
  it('throws for zero maxConcurrent', () => {
    expect(() => new Bulkhead(0)).toThrow('maxConcurrent must be a positive finite integer');
  });

  it('throws for negative maxConcurrent', () => {
    expect(() => new Bulkhead(-1)).toThrow('maxConcurrent must be a positive finite integer');
  });

  it('throws for non-finite maxConcurrent', () => {
    expect(() => new Bulkhead(Infinity)).toThrow('maxConcurrent must be a positive finite integer');
  });

  it('throws for negative maxQueue', () => {
    expect(() => new Bulkhead(1, -1)).toThrow('maxQueue must be a non-negative number');
  });
});

describe('withRetryAndTimeout', () => {
  it('retries timed-out operations', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) {
        await new Promise((r) => setTimeout(r, 200));
      }
      return 'success';
    };
    const result = await withRetryAndTimeout(
      fn,
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 },
      { timeoutMs: 50 },
    );
    expect(result).toBe('success');
    expect(calls).toBe(3);
  });

  it('fails after all retries time out', async () => {
    const fn = () => new Promise<string>((r) => setTimeout(() => r('late'), 200));
    await expect(
      withRetryAndTimeout(
        fn,
        { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 10 },
        { timeoutMs: 10, message: 'too slow' },
      ),
    ).rejects.toThrow('too slow');
  });
});

describe('withFallback', () => {
  it('returns the primary result on success', async () => {
    const result = await withFallback(() => Promise.resolve('primary'), 'backup');
    expect(result).toBe('primary');
  });

  it('returns the static fallback on failure', async () => {
    const result = await withFallback(() => Promise.reject(new Error('fail')), 'backup');
    expect(result).toBe('backup');
  });

  it('calls fallback function with the error', async () => {
    const result = await withFallback(
      () => Promise.reject(new Error('oops')),
      (err) => `recovered: ${(err as Error).message}`,
    );
    expect(result).toBe('recovered: oops');
  });

  it('returns fallback for non-Error throws', async () => {
    const result = await withFallback(
      () => Promise.reject('string error'),
      'safe',
    );
    expect(result).toBe('safe');
  });
});

describe('CircuitBreaker onStateChange', () => {
  it('fires callback on state transitions', async () => {
    const transitions: Array<{ from: CircuitState; to: CircuitState }> = [];
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 50,
      onStateChange: (from, to) => transitions.push({ from, to }),
    });

    // closed -> open
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(transitions).toEqual([{ from: 'closed', to: 'open' }]);

    // open -> half-open (via getState after timeout)
    await new Promise((r) => setTimeout(r, 60));
    cb.getState();
    expect(transitions).toEqual([
      { from: 'closed', to: 'open' },
      { from: 'open', to: 'half-open' },
    ]);

    // half-open -> closed (on success)
    await cb.execute(() => Promise.resolve('ok'));
    expect(transitions).toEqual([
      { from: 'closed', to: 'open' },
      { from: 'open', to: 'half-open' },
      { from: 'half-open', to: 'closed' },
    ]);
  });

  it('does not fire callback when state does not change', async () => {
    const spy = vi.fn();
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      onStateChange: spy,
    });

    // success while closed -> stays closed, no transition
    await cb.execute(() => Promise.resolve('ok'));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('RetryableError', () => {
  it('creates a retryable error by default', () => {
    const err = new RetryableError('temporary failure');
    expect(err.message).toBe('temporary failure');
    expect(err.retryable).toBe(true);
    expect(err.retryAfterMs).toBeUndefined();
    expect(err.name).toBe('RetryableError');
    expect(err).toBeInstanceOf(Error);
  });

  it('supports non-retryable errors', () => {
    const err = new RetryableError('permanent', { retryable: false });
    expect(err.retryable).toBe(false);
  });

  it('supports retryAfterMs hint', () => {
    const err = new RetryableError('rate limited', { retryable: true, retryAfterMs: 5000 });
    expect(err.retryAfterMs).toBe(5000);
  });
});

describe('isRetryableError', () => {
  it('returns true for RetryableError with retryable=true', () => {
    expect(isRetryableError(new RetryableError('temp'))).toBe(true);
  });

  it('returns false for RetryableError with retryable=false', () => {
    expect(isRetryableError(new RetryableError('perm', { retryable: false }))).toBe(false);
  });

  it('returns true for generic errors (assumed retryable)', () => {
    expect(isRetryableError(new Error('generic'))).toBe(true);
  });

  it('returns true for non-Error values', () => {
    expect(isRetryableError('string error')).toBe(true);
  });

  it('works as isRetryable predicate with withRetry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RetryableError('temp'))
      .mockRejectedValueOnce(new RetryableError('stop', { retryable: false }))
      .mockResolvedValue('ok');

    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        baseDelayMs: 1,
        maxDelayMs: 10,
        isRetryable: isRetryableError,
      }),
    ).rejects.toThrow('stop');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('SlidingWindowRateLimiter', () => {
  it('allows requests within the limit', () => {
    const rl = new SlidingWindowRateLimiter({ maxRequests: 3, windowMs: 1000 });
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.getCount()).toBe(3);
    expect(rl.getRemaining()).toBe(0);
  });

  it('rejects requests over the limit', () => {
    const rl = new SlidingWindowRateLimiter({ maxRequests: 2, windowMs: 1000 });
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(false);
  });

  it('allows requests after the window expires', async () => {
    const rl = new SlidingWindowRateLimiter({ maxRequests: 1, windowMs: 30 });
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(false);

    await new Promise((r) => setTimeout(r, 40));
    expect(rl.tryAcquire()).toBe(true);
  });

  it('getRemaining reflects available capacity', () => {
    const rl = new SlidingWindowRateLimiter({ maxRequests: 5, windowMs: 1000 });
    expect(rl.getRemaining()).toBe(5);
    rl.tryAcquire();
    rl.tryAcquire();
    expect(rl.getRemaining()).toBe(3);
  });

  it('reset clears all timestamps', () => {
    const rl = new SlidingWindowRateLimiter({ maxRequests: 2, windowMs: 1000 });
    rl.tryAcquire();
    rl.tryAcquire();
    expect(rl.getRemaining()).toBe(0);
    rl.reset();
    expect(rl.getRemaining()).toBe(2);
    expect(rl.getCount()).toBe(0);
  });

  it('throws for invalid maxRequests', () => {
    expect(() => new SlidingWindowRateLimiter({ maxRequests: 0, windowMs: 1000 })).toThrow(
      'maxRequests must be a positive finite integer',
    );
    expect(() => new SlidingWindowRateLimiter({ maxRequests: -1, windowMs: 1000 })).toThrow(
      'maxRequests must be a positive finite integer',
    );
    expect(() => new SlidingWindowRateLimiter({ maxRequests: Infinity, windowMs: 1000 })).toThrow(
      'maxRequests must be a positive finite integer',
    );
  });

  it('throws for invalid windowMs', () => {
    expect(() => new SlidingWindowRateLimiter({ maxRequests: 10, windowMs: 0 })).toThrow(
      'windowMs must be a positive finite number',
    );
    expect(() => new SlidingWindowRateLimiter({ maxRequests: 10, windowMs: -100 })).toThrow(
      'windowMs must be a positive finite number',
    );
  });
});

describe('ResiliencePipeline', () => {
  it('executes a simple function with no strategies', async () => {
    const pipeline = new ResiliencePipeline<string>({});
    const result = await pipeline.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('applies timeout strategy', async () => {
    const pipeline = new ResiliencePipeline<string>({ timeout: { timeoutMs: 10 } });
    await expect(
      pipeline.execute(() => new Promise((r) => setTimeout(() => r('late'), 200))),
    ).rejects.toThrow('timed out');
  });

  it('applies retry strategy', async () => {
    const pipeline = new ResiliencePipeline<string>({
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 },
    });
    let calls = 0;
    const result = await pipeline.execute(async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'recovered';
    });
    expect(result).toBe('recovered');
    expect(calls).toBe(3);
  });

  it('applies circuit breaker strategy', async () => {
    const pipeline = new ResiliencePipeline<string>({
      circuitBreaker: { failureThreshold: 1, resetTimeoutMs: 60000 },
    });
    await expect(pipeline.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    await expect(pipeline.execute(() => Promise.resolve('ok'))).rejects.toThrow('Circuit breaker is open');
  });

  it('applies fallback strategy', async () => {
    const pipeline = new ResiliencePipeline<string>({ fallback: 'default' });
    const result = await pipeline.execute(() => Promise.reject(new Error('fail')));
    expect(result).toBe('default');
  });

  it('applies fallback function strategy', async () => {
    const pipeline = new ResiliencePipeline<string>({
      fallback: (err) => `recovered: ${(err as Error).message}`,
    });
    const result = await pipeline.execute(() => Promise.reject(new Error('oops')));
    expect(result).toBe('recovered: oops');
  });

  it('composes retry + timeout correctly', async () => {
    const pipeline = new ResiliencePipeline<string>({
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 },
      timeout: { timeoutMs: 20 },
    });
    let calls = 0;
    const result = await pipeline.execute(async () => {
      calls++;
      if (calls === 1) await new Promise((r) => setTimeout(r, 200));
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('composes all strategies together', async () => {
    const pipeline = new ResiliencePipeline<string>({
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 10 },
      timeout: { timeoutMs: 50 },
      circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60000 },
      fallback: 'safe-default',
    });

    // Function that always fails => retries exhaust => circuit breaker records failures => fallback kicks in
    const result = await pipeline.execute(() => Promise.reject(new Error('down')));
    expect(result).toBe('safe-default');
  });

  it('getCircuitBreaker returns the internal CB instance', () => {
    const pipeline = new ResiliencePipeline<string>({
      circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 1000 },
    });
    const cb = pipeline.getCircuitBreaker();
    expect(cb).toBeDefined();
    expect(cb!.getState()).toBe('closed');
  });

  it('getCircuitBreaker returns undefined when not configured', () => {
    const pipeline = new ResiliencePipeline<string>({});
    expect(pipeline.getCircuitBreaker()).toBeUndefined();
  });
});

describe('withHedging', () => {
  it('resolves with the primary result when it succeeds quickly', async () => {
    const fn = vi.fn().mockResolvedValue('fast');
    const result = await withHedging(fn, { delayMs: 100 });
    expect(result).toBe('fast');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('launches a hedged attempt after delayMs', async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) {
        // Primary is slow
        return new Promise((r) => setTimeout(() => r('slow'), 200));
      }
      // Hedged attempt is fast
      return Promise.resolve('hedged');
    });
    const result = await withHedging(fn, { delayMs: 10 });
    expect(result).toBe('hedged');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('returns whichever attempt resolves first', async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) return new Promise((r) => setTimeout(() => r('primary'), 50));
      return new Promise((r) => setTimeout(() => r('hedge'), 200));
    });
    const result = await withHedging(fn, { delayMs: 10 });
    expect(result).toBe('primary');
  });

  it('throws the last error when all attempts fail', async () => {
    // Both attempts are slow enough that the hedge fires before either settles
    const fn = vi.fn().mockImplementation(() =>
      new Promise((_, reject) => setTimeout(() => reject(new Error('fail')), 30)),
    );
    await expect(withHedging(fn, { delayMs: 5 })).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('succeeds if primary fails but hedge succeeds', async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) {
        // Primary is slow then fails
        return new Promise((_, reject) => setTimeout(() => reject(new Error('fail')), 50));
      }
      // Hedged attempt succeeds
      return Promise.resolve('ok');
    });
    const result = await withHedging(fn, { delayMs: 5 });
    expect(result).toBe('ok');
  });

  it('supports maxAttempts > 2', async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(() => {
      calls++;
      if (calls < 3) return new Promise((r) => setTimeout(() => r(`slow-${calls}`), 500));
      return Promise.resolve('third');
    });
    const result = await withHedging(fn, { delayMs: 10, maxAttempts: 3 });
    expect(result).toBe('third');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws if maxAttempts < 1', async () => {
    await expect(
      withHedging(() => Promise.resolve('ok'), { delayMs: 10, maxAttempts: 0 }),
    ).rejects.toThrow('maxAttempts must be at least 1');
  });

  it('runs fn directly when maxAttempts is 1', async () => {
    const fn = vi.fn().mockResolvedValue('only');
    const result = await withHedging(fn, { delayMs: 10, maxAttempts: 1 });
    expect(result).toBe('only');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('RetryBudget', () => {
  it('allows retries when under budget', () => {
    const budget = new RetryBudget({ maxRetryRatio: 0.5, windowMs: 10000 });
    budget.recordRequest();
    budget.recordRequest();
    expect(budget.canRetry()).toBe(true);
  });

  it('blocks retries when ratio would be exceeded', () => {
    const budget = new RetryBudget({ maxRetryRatio: 0.2, windowMs: 10000 });
    budget.recordRequest();
    budget.recordRetry();
    // 1 request + 1 retry = ratio 0.5, adding another retry would be (2+1)/(2+1+1) = 0.75
    expect(budget.canRetry()).toBe(false);
  });

  it('allows retries up to minRetriesPerWindow regardless of ratio', () => {
    const budget = new RetryBudget({ maxRetryRatio: 0.0, windowMs: 10000, minRetriesPerWindow: 3 });
    // Even with ratio 0, min retries are allowed
    expect(budget.canRetry()).toBe(true);
    budget.recordRetry();
    expect(budget.canRetry()).toBe(true);
    budget.recordRetry();
    expect(budget.canRetry()).toBe(true);
    budget.recordRetry();
    // Now at 3 retries, minRetries exceeded, ratio check kicks in
    expect(budget.canRetry()).toBe(false);
  });

  it('returns correct retry ratio', () => {
    const budget = new RetryBudget({ maxRetryRatio: 0.5, windowMs: 10000 });
    expect(budget.getRetryRatio()).toBe(0);
    budget.recordRequest();
    budget.recordRequest();
    budget.recordRetry();
    // 1 retry / 3 total = 0.333...
    expect(budget.getRetryRatio()).toBeCloseTo(1 / 3);
  });

  it('allows retry on empty window', () => {
    const budget = new RetryBudget({ maxRetryRatio: 0.2, windowMs: 10000 });
    expect(budget.canRetry()).toBe(true);
  });

  it('resets all counters', () => {
    const budget = new RetryBudget({ maxRetryRatio: 0.1, windowMs: 10000 });
    budget.recordRequest();
    budget.recordRetry();
    budget.reset();
    expect(budget.getRetryRatio()).toBe(0);
    expect(budget.canRetry()).toBe(true);
  });

  it('throws for invalid maxRetryRatio', () => {
    expect(() => new RetryBudget({ maxRetryRatio: -0.1, windowMs: 1000 })).toThrow('maxRetryRatio');
    expect(() => new RetryBudget({ maxRetryRatio: 1.5, windowMs: 1000 })).toThrow('maxRetryRatio');
    expect(() => new RetryBudget({ maxRetryRatio: NaN, windowMs: 1000 })).toThrow('maxRetryRatio');
  });

  it('throws for invalid windowMs', () => {
    expect(() => new RetryBudget({ maxRetryRatio: 0.2, windowMs: 0 })).toThrow('windowMs');
    expect(() => new RetryBudget({ maxRetryRatio: 0.2, windowMs: -100 })).toThrow('windowMs');
  });
});

describe('FallbackChain', () => {
  it('returns the first successful provider result', async () => {
    const chain = new FallbackChain<string>()
      .add('primary', async () => 'primary-value');
    const result = await chain.execute();
    expect(result).toEqual({ value: 'primary-value', provider: 'primary' });
  });

  it('falls back to the next provider on failure', async () => {
    const chain = new FallbackChain<string>()
      .add('primary', async () => { throw new Error('down'); })
      .add('secondary', async () => 'secondary-value');
    const result = await chain.execute();
    expect(result).toEqual({ value: 'secondary-value', provider: 'secondary' });
  });

  it('throws when all providers fail', async () => {
    const chain = new FallbackChain<string>()
      .add('a', async () => { throw new Error('fail-a'); })
      .add('b', async () => { throw new Error('fail-b'); });
    await expect(chain.execute()).rejects.toThrow('All providers failed');
  });

  it('throws when chain is empty', async () => {
    const chain = new FallbackChain<string>();
    await expect(chain.execute()).rejects.toThrow('no providers');
  });

  it('lists provider names in order', () => {
    const chain = new FallbackChain<number>()
      .add('first', async () => 1)
      .add('second', async () => 2);
    expect(chain.list()).toEqual(['first', 'second']);
  });

  it('does not call later providers if an earlier one succeeds', async () => {
    const spy = vi.fn(async () => 'never');
    const chain = new FallbackChain<string>()
      .add('fast', async () => 'ok')
      .add('slow', spy);
    await chain.execute();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('AdaptiveConcurrencyLimiter', () => {
  it('starts with the initial limit', () => {
    const limiter = new AdaptiveConcurrencyLimiter({
      initialLimit: 5,
      minLimit: 1,
      maxLimit: 20,
    });
    expect(limiter.getLimit()).toBe(5);
    expect(limiter.getRunning()).toBe(0);
    expect(limiter.getQueueLength()).toBe(0);
  });

  it('increases limit on success', async () => {
    const limiter = new AdaptiveConcurrencyLimiter({
      initialLimit: 5,
      minLimit: 1,
      maxLimit: 20,
    });
    await limiter.execute(async () => 'ok');
    expect(limiter.getLimit()).toBe(6);
  });

  it('decreases limit on failure', async () => {
    const limiter = new AdaptiveConcurrencyLimiter({
      initialLimit: 5,
      minLimit: 1,
      maxLimit: 20,
    });
    await expect(limiter.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    expect(limiter.getLimit()).toBe(4);
  });

  it('does not go below minLimit', async () => {
    const limiter = new AdaptiveConcurrencyLimiter({
      initialLimit: 1,
      minLimit: 1,
      maxLimit: 10,
    });
    await expect(limiter.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
    expect(limiter.getLimit()).toBe(1);
  });

  it('does not go above maxLimit', async () => {
    const limiter = new AdaptiveConcurrencyLimiter({
      initialLimit: 10,
      minLimit: 1,
      maxLimit: 10,
    });
    await limiter.execute(async () => 'ok');
    expect(limiter.getLimit()).toBe(10);
  });

  it('respects custom increaseBy and decreaseBy', async () => {
    const limiter = new AdaptiveConcurrencyLimiter({
      initialLimit: 10,
      minLimit: 1,
      maxLimit: 20,
      increaseBy: 3,
      decreaseBy: 5,
    });
    await limiter.execute(async () => 'ok');
    expect(limiter.getLimit()).toBe(13);
    await expect(limiter.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
    expect(limiter.getLimit()).toBe(8);
  });

  it('queues work when at capacity', async () => {
    const limiter = new AdaptiveConcurrencyLimiter({
      initialLimit: 1,
      minLimit: 1,
      maxLimit: 5,
    });
    let resolve1!: () => void;
    const p1 = limiter.execute(() => new Promise<string>((r) => { resolve1 = () => r('first'); }));
    expect(limiter.getRunning()).toBe(1);

    const p2 = limiter.execute(async () => 'second');
    expect(limiter.getQueueLength()).toBe(1);

    resolve1();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('first');
    expect(r2).toBe('second');
    expect(limiter.getRunning()).toBe(0);
    expect(limiter.getQueueLength()).toBe(0);
  });

  it('throws for invalid initialLimit', () => {
    expect(() => new AdaptiveConcurrencyLimiter({
      initialLimit: 0, minLimit: 1, maxLimit: 10,
    })).toThrow('initialLimit');
  });

  it('throws for invalid minLimit', () => {
    expect(() => new AdaptiveConcurrencyLimiter({
      initialLimit: 5, minLimit: 0, maxLimit: 10,
    })).toThrow('minLimit');
  });

  it('throws when maxLimit < minLimit', () => {
    expect(() => new AdaptiveConcurrencyLimiter({
      initialLimit: 5, minLimit: 10, maxLimit: 5,
    })).toThrow('maxLimit');
  });

  it('throws when initialLimit is outside range', () => {
    expect(() => new AdaptiveConcurrencyLimiter({
      initialLimit: 15, minLimit: 1, maxLimit: 10,
    })).toThrow('initialLimit');
  });

  it('drain resolves immediately when idle', async () => {
    const limiter = new AdaptiveConcurrencyLimiter({
      initialLimit: 5,
      minLimit: 1,
      maxLimit: 10,
    });
    await limiter.drain(); // should not hang
  });

  it('drain waits for in-flight work to complete', async () => {
    const limiter = new AdaptiveConcurrencyLimiter({
      initialLimit: 2,
      minLimit: 1,
      maxLimit: 10,
    });
    let resolve1!: () => void;
    let resolve2!: () => void;
    const p1 = limiter.execute(() => new Promise<string>((r) => { resolve1 = () => r('a'); }));
    const p2 = limiter.execute(() => new Promise<string>((r) => { resolve2 = () => r('b'); }));

    let drained = false;
    const drainP = limiter.drain().then(() => { drained = true; });

    // Not yet drained
    expect(drained).toBe(false);

    resolve1();
    await p1;
    // Still one in flight
    expect(drained).toBe(false);

    resolve2();
    await p2;
    await drainP;
    expect(drained).toBe(true);
  });

  it('drain waits for queued work to complete', async () => {
    const limiter = new AdaptiveConcurrencyLimiter({
      initialLimit: 1,
      minLimit: 1,
      maxLimit: 5,
    });
    let resolve1!: () => void;
    const p1 = limiter.execute(() => new Promise<string>((r) => { resolve1 = () => r('first'); }));
    const p2 = limiter.execute(async () => 'second');
    expect(limiter.getQueueLength()).toBe(1);

    let drained = false;
    const drainP = limiter.drain().then(() => { drained = true; });

    resolve1();
    await Promise.all([p1, p2]);
    await drainP;
    expect(drained).toBe(true);
    expect(limiter.getRunning()).toBe(0);
    expect(limiter.getQueueLength()).toBe(0);
  });
});

describe('PeriodicTask', () => {
  it('starts in idle status', () => {
    const task = new PeriodicTask(async () => {}, { intervalMs: 100 });
    expect(task.getStatus()).toBe('idle');
    expect(task.getRunCount()).toBe(0);
    expect(task.getErrorCount()).toBe(0);
    expect(task.getLastError()).toBeUndefined();
  });

  it('throws for invalid intervalMs', () => {
    expect(() => new PeriodicTask(async () => {}, { intervalMs: 0 })).toThrow('intervalMs');
    expect(() => new PeriodicTask(async () => {}, { intervalMs: -1 })).toThrow('intervalMs');
    expect(() => new PeriodicTask(async () => {}, { intervalMs: Infinity })).toThrow('intervalMs');
  });

  it('throws for invalid jitter', () => {
    expect(() => new PeriodicTask(async () => {}, { intervalMs: 100, jitter: -0.1 })).toThrow('jitter');
    expect(() => new PeriodicTask(async () => {}, { intervalMs: 100, jitter: 1.5 })).toThrow('jitter');
  });

  it('executes periodically and can be stopped', async () => {
    vi.useFakeTimers();
    let count = 0;
    const task = new PeriodicTask(async () => { count++; }, { intervalMs: 50 });

    task.start();
    expect(task.getStatus()).toBe('running');

    await vi.advanceTimersByTimeAsync(50);
    expect(count).toBe(1);

    await vi.advanceTimersByTimeAsync(50);
    expect(count).toBe(2);

    task.stop();
    expect(task.getStatus()).toBe('stopped');

    await vi.advanceTimersByTimeAsync(200);
    expect(count).toBe(2); // no more runs after stop
    expect(task.getRunCount()).toBe(2);

    vi.useRealTimers();
  });

  it('runs immediately when immediate option is set', async () => {
    vi.useFakeTimers();
    let count = 0;
    const task = new PeriodicTask(async () => { count++; }, { intervalMs: 100, immediate: true });

    task.start();
    // immediate tick is a microtask, flush it
    await vi.advanceTimersByTimeAsync(0);
    expect(count).toBe(1);

    task.stop();
    vi.useRealTimers();
  });

  it('tracks errors without stopping', async () => {
    vi.useFakeTimers();
    const err = new Error('boom');
    let callCount = 0;
    const task = new PeriodicTask(async () => {
      callCount++;
      if (callCount <= 2) throw err;
    }, { intervalMs: 50 });

    task.start();

    await vi.advanceTimersByTimeAsync(50); // first tick - error
    expect(task.getErrorCount()).toBe(1);
    expect(task.getLastError()).toBe(err);

    await vi.advanceTimersByTimeAsync(50); // second tick - error
    expect(task.getErrorCount()).toBe(2);

    await vi.advanceTimersByTimeAsync(50); // third tick - success
    expect(task.getRunCount()).toBe(1);
    expect(task.getErrorCount()).toBe(2);

    task.stop();
    vi.useRealTimers();
  });

  it('start is a no-op if already running', async () => {
    vi.useFakeTimers();
    let count = 0;
    const task = new PeriodicTask(async () => { count++; }, { intervalMs: 50 });

    task.start();
    task.start(); // should not create a second timer

    await vi.advanceTimersByTimeAsync(50);
    expect(count).toBe(1); // only one tick, not two

    task.stop();
    vi.useRealTimers();
  });

  it('stop is a no-op if not running', () => {
    const task = new PeriodicTask(async () => {}, { intervalMs: 100 });
    task.stop(); // should not throw
    expect(task.getStatus()).toBe('idle');
  });
});

describe('Semaphore', () => {
  it('throws for invalid maxPermits', () => {
    expect(() => new Semaphore({ maxPermits: 0 })).toThrow('positive finite integer');
    expect(() => new Semaphore({ maxPermits: -1 })).toThrow('positive finite integer');
    expect(() => new Semaphore({ maxPermits: Infinity })).toThrow('positive finite integer');
    expect(() => new Semaphore({ maxPermits: NaN })).toThrow('positive finite integer');
  });

  it('starts with full permits', () => {
    const sem = new Semaphore({ maxPermits: 3 });
    expect(sem.getAvailable()).toBe(3);
    expect(sem.getWaiterCount()).toBe(0);
  });

  it('acquire decrements available permits', async () => {
    const sem = new Semaphore({ maxPermits: 2 });
    await sem.acquire();
    expect(sem.getAvailable()).toBe(1);
    await sem.acquire();
    expect(sem.getAvailable()).toBe(0);
  });

  it('tryAcquire returns true when permits available', () => {
    const sem = new Semaphore({ maxPermits: 1 });
    expect(sem.tryAcquire()).toBe(true);
    expect(sem.getAvailable()).toBe(0);
  });

  it('tryAcquire returns false when no permits available', async () => {
    const sem = new Semaphore({ maxPermits: 1 });
    await sem.acquire();
    expect(sem.tryAcquire()).toBe(false);
  });

  it('release increments available permits', async () => {
    const sem = new Semaphore({ maxPermits: 2 });
    await sem.acquire();
    expect(sem.getAvailable()).toBe(1);
    sem.release();
    expect(sem.getAvailable()).toBe(2);
  });

  it('release throws when all permits already available', () => {
    const sem = new Semaphore({ maxPermits: 2 });
    expect(() => sem.release()).toThrow('Cannot release: all permits already available');
  });

  it('release unblocks a waiting acquire', async () => {
    const sem = new Semaphore({ maxPermits: 1 });
    await sem.acquire();

    let acquired = false;
    const waitPromise = sem.acquire().then(() => {
      acquired = true;
    });

    expect(sem.getWaiterCount()).toBe(1);
    expect(acquired).toBe(false);

    sem.release();
    await waitPromise;
    expect(acquired).toBe(true);
    expect(sem.getWaiterCount()).toBe(0);
  });

  it('use acquires and releases around fn', async () => {
    const sem = new Semaphore({ maxPermits: 1 });
    const result = await sem.use(async () => {
      expect(sem.getAvailable()).toBe(0);
      return 42;
    });
    expect(result).toBe(42);
    expect(sem.getAvailable()).toBe(1);
  });

  it('use releases permit even if fn throws', async () => {
    const sem = new Semaphore({ maxPermits: 1 });
    await expect(
      sem.use(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(sem.getAvailable()).toBe(1);
  });

  it('enforces concurrency limit via use', async () => {
    const sem = new Semaphore({ maxPermits: 2 });
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
    };

    await Promise.all([
      sem.use(task),
      sem.use(task),
      sem.use(task),
      sem.use(task),
    ]);

    expect(maxConcurrent).toBe(2);
  });

  it('maintains FIFO order for waiters', async () => {
    const sem = new Semaphore({ maxPermits: 1 });
    await sem.acquire();

    const order: number[] = [];
    const p1 = sem.acquire().then(() => order.push(1));
    const p2 = sem.acquire().then(() => order.push(2));

    expect(sem.getWaiterCount()).toBe(2);

    sem.release();
    await p1;
    sem.release();
    await p2;

    expect(order).toEqual([1, 2]);
  });
});

describe('ReadinessGate', () => {
  it('is ready by default with no conditions', () => {
    const gate = new ReadinessGate();
    expect(gate.isReady()).toBe(true);
  });

  it('is not ready when conditions are registered but unsatisfied', () => {
    const gate = new ReadinessGate();
    gate.register('db');
    gate.register('cache');
    expect(gate.isReady()).toBe(false);
    expect(gate.pending()).toEqual(['db', 'cache']);
  });

  it('becomes ready when all conditions are satisfied', () => {
    const gate = new ReadinessGate();
    gate.register('db');
    gate.register('cache');
    gate.satisfy('db');
    expect(gate.isReady()).toBe(false);
    expect(gate.pending()).toEqual(['cache']);
    gate.satisfy('cache');
    expect(gate.isReady()).toBe(true);
    expect(gate.pending()).toEqual([]);
  });

  it('throws when satisfying an unknown condition', () => {
    const gate = new ReadinessGate();
    expect(() => gate.satisfy('unknown')).toThrow('Unknown readiness condition: unknown');
  });

  it('throws when unsatisfying an unknown condition', () => {
    const gate = new ReadinessGate();
    expect(() => gate.unsatisfy('unknown')).toThrow('Unknown readiness condition: unknown');
  });

  it('can unsatisfy a previously satisfied condition', () => {
    const gate = new ReadinessGate();
    gate.register('db');
    gate.satisfy('db');
    expect(gate.isReady()).toBe(true);
    gate.unsatisfy('db');
    expect(gate.isReady()).toBe(false);
  });

  it('waitUntilReady resolves immediately if already ready', async () => {
    const gate = new ReadinessGate();
    gate.register('db');
    gate.satisfy('db');
    await gate.waitUntilReady(); // should not hang
  });

  it('waitUntilReady resolves when conditions are met', async () => {
    const gate = new ReadinessGate();
    gate.register('db');
    gate.register('cache');

    let resolved = false;
    const promise = gate.waitUntilReady().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    gate.satisfy('db');
    // Flush microtasks
    await Promise.resolve();
    expect(resolved).toBe(false);
    gate.satisfy('cache');
    await promise;
    expect(resolved).toBe(true);
  });

  it('reset makes all conditions unsatisfied', () => {
    const gate = new ReadinessGate();
    gate.register('db');
    gate.register('cache');
    gate.satisfy('db');
    gate.satisfy('cache');
    expect(gate.isReady()).toBe(true);
    gate.reset();
    expect(gate.isReady()).toBe(false);
    expect(gate.pending()).toEqual(['db', 'cache']);
  });

  it('duplicate register does not reset existing state', () => {
    const gate = new ReadinessGate();
    gate.register('db');
    gate.satisfy('db');
    gate.register('db'); // should be no-op
    expect(gate.isReady()).toBe(true);
  });
});

describe('ResourcePool', () => {
  let idCounter: number;
  const makePool = (overrides: Partial<import('./index').ResourcePoolOptions<{ id: number }>> = {}) => {
    idCounter = 0;
    return new ResourcePool<{ id: number }>({
      create: async () => ({ id: ++idCounter }),
      destroy: async () => {},
      maxSize: 3,
      ...overrides,
    });
  };

  it('creates resources on acquire', async () => {
    const pool = makePool();
    const r = await pool.acquire();
    expect(r.id).toBe(1);
    expect(pool.getInUseCount()).toBe(1);
    expect(pool.getIdleCount()).toBe(0);
  });

  it('reuses released resources', async () => {
    const pool = makePool();
    const r1 = await pool.acquire();
    pool.release(r1);
    expect(pool.getIdleCount()).toBe(1);
    const r2 = await pool.acquire();
    expect(r2.id).toBe(1); // same resource reused
    expect(pool.getIdleCount()).toBe(0);
  });

  it('respects maxSize and queues waiters', async () => {
    const pool = makePool({ maxSize: 1 });
    const r1 = await pool.acquire();
    expect(pool.getSize()).toBe(1);

    let resolved = false;
    const p = pool.acquire().then((r) => {
      resolved = true;
      return r;
    });

    // Waiter should be queued
    expect(pool.getWaiterCount()).toBe(1);
    expect(resolved).toBe(false);

    pool.release(r1);
    const r2 = await p;
    expect(resolved).toBe(true);
    expect(r2.id).toBe(1); // same resource handed to waiter
    pool.release(r2);
  });

  it('validates resources before handing them out', async () => {
    let validateCount = 0;
    const pool = makePool({
      validate: async (r) => {
        validateCount++;
        return r.id !== 1; // reject resource 1
      },
    });

    const r1 = await pool.acquire();
    expect(r1.id).toBe(1);
    pool.release(r1);

    // Acquiring again should reject r1 and create r2
    const r2 = await pool.acquire();
    expect(r2.id).toBe(2);
    expect(validateCount).toBe(1);
    pool.release(r2);
  });

  it('acquire times out when pool is exhausted', async () => {
    const pool = makePool({ maxSize: 1, acquireTimeoutMs: 50 });
    await pool.acquire(); // take the only slot

    await expect(pool.acquire()).rejects.toThrow('timed out');
  });

  it('evicts idle resources past timeout', async () => {
    vi.useFakeTimers();
    try {
      const destroyed: number[] = [];
      const pool = makePool({
        idleTimeoutMs: 100,
        destroy: async (r) => { destroyed.push(r.id); },
      });
      const r1 = await pool.acquire();
      const r2 = await pool.acquire();
      pool.release(r1);
      pool.release(r2);
      expect(pool.getIdleCount()).toBe(2);

      vi.advanceTimersByTime(150);
      const evicted = pool.evictIdle();
      expect(evicted).toBe(2);
      expect(pool.getIdleCount()).toBe(0);
      expect(destroyed).toEqual([1, 2]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('evictIdle respects minIdle', async () => {
    vi.useFakeTimers();
    try {
      const pool = makePool({ idleTimeoutMs: 100, minIdle: 1 });
      const r1 = await pool.acquire();
      const r2 = await pool.acquire();
      pool.release(r1);
      pool.release(r2);

      vi.advanceTimersByTime(150);
      const evicted = pool.evictIdle();
      expect(evicted).toBe(1);
      expect(pool.getIdleCount()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('close destroys idle resources and rejects waiters', async () => {
    const destroyed: number[] = [];
    const pool = makePool({
      maxSize: 1,
      destroy: async (r) => { destroyed.push(r.id); },
    });
    const r1 = await pool.acquire();
    pool.release(r1);

    // Queue a waiter
    const r2Promise = pool.acquire(); // gets r1
    const r2 = await r2Promise;
    const waiterPromise = pool.acquire(); // should queue

    await pool.close();
    await expect(waiterPromise).rejects.toThrow('closed');
    pool.release(r2); // release after close destroys
    expect(destroyed).toContain(r2.id);
  });

  it('throws on acquire after close', async () => {
    const pool = makePool();
    await pool.close();
    await expect(pool.acquire()).rejects.toThrow('closed');
  });

  it('throws on invalid maxSize', () => {
    expect(() => makePool({ maxSize: 0 })).toThrow('maxSize');
    expect(() => makePool({ maxSize: -1 })).toThrow('maxSize');
  });

  it('throws on invalid minIdle', () => {
    expect(() => makePool({ minIdle: -1 })).toThrow('minIdle');
    expect(() => makePool({ maxSize: 2, minIdle: 5 })).toThrow('minIdle');
  });

  it('getSize returns idle + inUse', async () => {
    const pool = makePool();
    const r1 = await pool.acquire();
    const r2 = await pool.acquire();
    pool.release(r1);
    expect(pool.getSize()).toBe(2); // 1 idle + 1 in-use
    pool.release(r2);
    expect(pool.getSize()).toBe(2); // 2 idle
  });
});

describe('DependencyChecker', () => {
  it('reports all healthy when all probes pass', async () => {
    const checker = new DependencyChecker(1000);
    checker
      .register({ service: 'db', probe: async () => {} })
      .register({ service: 'cache', probe: async () => {} });

    const result = await checker.checkAll();
    expect(result.ready).toBe(true);
    expect(result.requiredHealthy).toBe(true);
    expect(result.services).toHaveLength(2);
    expect(result.services.every((s) => s.healthy)).toBe(true);
  });

  it('reports not ready when a probe fails', async () => {
    const checker = new DependencyChecker(1000);
    checker
      .register({ service: 'db', probe: async () => {} })
      .register({
        service: 'cache',
        probe: async () => {
          throw new Error('connection refused');
        },
      });

    const result = await checker.checkAll();
    expect(result.ready).toBe(false);
    const cacheStatus = result.services.find((s) => s.service === 'cache');
    expect(cacheStatus?.healthy).toBe(false);
    expect(cacheStatus?.error).toContain('connection refused');
  });

  it('times out hanging probes using per-probe timeout', async () => {
    const checker = new DependencyChecker(5000);
    checker.register({
      service: 'slow-service',
      probe: () => new Promise(() => {}), // never resolves
      timeoutMs: 50,
    });

    const result = await checker.checkAll();
    expect(result.ready).toBe(false);
    expect(result.services[0]?.healthy).toBe(false);
    expect(result.services[0]?.error).toContain('timed out');
  });

  it('times out using default timeout when no per-probe timeout set', async () => {
    const checker = new DependencyChecker(50);
    checker.register({
      service: 'slow-service',
      probe: () => new Promise(() => {}),
    });

    const result = await checker.checkAll();
    expect(result.ready).toBe(false);
    expect(result.services[0]?.healthy).toBe(false);
  });

  it('distinguishes required vs optional dependencies', async () => {
    const checker = new DependencyChecker(1000);
    checker
      .register({ service: 'db', probe: async () => {}, required: true })
      .register({
        service: 'metrics',
        probe: async () => {
          throw new Error('down');
        },
        required: false,
      });

    const result = await checker.checkAll();
    expect(result.ready).toBe(false); // not all healthy
    expect(result.requiredHealthy).toBe(true); // required deps are fine
  });

  it('returns empty results when no dependencies registered', async () => {
    const checker = new DependencyChecker(1000);
    const result = await checker.checkAll();
    expect(result.ready).toBe(true);
    expect(result.requiredHealthy).toBe(true);
    expect(result.services).toHaveLength(0);
  });

  it('list returns registered service names', () => {
    const checker = new DependencyChecker();
    checker
      .register({ service: 'db', probe: async () => {} })
      .register({ service: 'cache', probe: async () => {} });
    expect(checker.list()).toEqual(['db', 'cache']);
  });

  it('throws on invalid defaultTimeoutMs', () => {
    expect(() => new DependencyChecker(0)).toThrow('positive finite number');
    expect(() => new DependencyChecker(-100)).toThrow('positive finite number');
    expect(() => new DependencyChecker(Infinity)).toThrow('positive finite number');
  });

  it('tracks latency in results', async () => {
    const checker = new DependencyChecker(1000);
    checker.register({ service: 'db', probe: async () => {} });
    const result = await checker.checkAll();
    expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.services[0]?.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
