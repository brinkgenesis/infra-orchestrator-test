import { describe, it, expect, vi } from 'vitest';
import {
  computeBackoff,
  withRetry,
  CircuitBreaker,
  checkHealth,
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
});
