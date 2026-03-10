import { describe, it, expect, vi } from 'vitest';
import {
  computeBackoff,
  withRetry,
  CircuitBreaker,
  checkHealth,
  withTimeout,
  Bulkhead,
  RateLimiter,
  GracefulShutdown,
} from './index';

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

  it('rejects calls when open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow('Circuit breaker is open');
  });

  it('transitions to half-open after timeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState()).toBe('half-open');
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

  it('rejects if operation exceeds timeout', async () => {
    await expect(
      withTimeout(
        () => new Promise((r) => setTimeout(r, 200)),
        { timeoutMs: 10 },
      ),
    ).rejects.toThrow('Operation timed out after 10ms');
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

  it('rejects when queue is full', async () => {
    const bh = new Bulkhead(1, 0);
    const blocker = new Promise<string>((resolve) => {
      setTimeout(() => resolve('done'), 100);
    });
    const first = bh.execute(() => blocker);

    await expect(bh.execute(() => Promise.resolve('x'))).rejects.toThrow('Bulkhead queue is full');
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
