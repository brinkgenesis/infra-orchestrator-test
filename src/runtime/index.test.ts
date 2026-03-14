import { describe, it, expect, vi } from 'vitest';
import {
  computeBackoff,
  withRetry,
  withTimeout,
  TimeoutError,
  CircuitBreaker,
  checkHealth,
  isNonNullable,
  assertNonNullable,
  isRecord,
  assertType,
  exhaustiveCheck,
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

  it('returns value in [0, capped] when jitter is enabled', () => {
    const opts = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000 };
    for (let i = 0; i < 50; i++) {
      const val = computeBackoff(0, opts, true);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
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

  it('throws if maxAttempts is less than 1', async () => {
    await expect(
      withRetry(() => Promise.resolve('ok'), { maxAttempts: 0, baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('maxAttempts must be at least 1');
    await expect(
      withRetry(() => Promise.resolve('ok'), { maxAttempts: -1, baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('maxAttempts must be at least 1');
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

  it('resets to closed state via reset()', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    cb.reset();
    expect(cb.getState()).toBe('closed');

    const result = await cb.execute(() => Promise.resolve('after reset'));
    expect(result).toBe('after reset');
  });

  it('throws for invalid failureThreshold', () => {
    expect(() => new CircuitBreaker({ failureThreshold: 0, resetTimeoutMs: 1000 })).toThrow(
      'failureThreshold must be a positive finite integer',
    );
    expect(() => new CircuitBreaker({ failureThreshold: -1, resetTimeoutMs: 1000 })).toThrow(
      'failureThreshold must be a positive finite integer',
    );
    expect(() => new CircuitBreaker({ failureThreshold: Infinity, resetTimeoutMs: 1000 })).toThrow(
      'failureThreshold must be a positive finite integer',
    );
  });

  it('throws for invalid resetTimeoutMs', () => {
    expect(() => new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 0 })).toThrow(
      'resetTimeoutMs must be a positive finite number',
    );
    expect(() => new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: -100 })).toThrow(
      'resetTimeoutMs must be a positive finite number',
    );
  });
});

describe('withTimeout', () => {
  it('resolves when fn completes before deadline', async () => {
    const result = await withTimeout(() => Promise.resolve(42), 1000);
    expect(result).toBe(42);
  });

  it('rejects with TimeoutError when fn exceeds deadline', async () => {
    const slow = () => new Promise<string>((r) => setTimeout(() => r('late'), 500));
    await expect(withTimeout(slow, 10)).rejects.toThrow(TimeoutError);
    await expect(withTimeout(slow, 10)).rejects.toThrow('Operation timed out after 10ms');
  });

  it('throws RangeError for non-positive timeout', async () => {
    await expect(withTimeout(() => Promise.resolve('x'), 0)).rejects.toThrow(RangeError);
    await expect(withTimeout(() => Promise.resolve('x'), -1)).rejects.toThrow(RangeError);
  });
});

describe('isNonNullable', () => {
  it('returns true for defined values', () => {
    expect(isNonNullable(0)).toBe(true);
    expect(isNonNullable('')).toBe(true);
    expect(isNonNullable(false)).toBe(true);
    expect(isNonNullable({})).toBe(true);
  });

  it('returns false for null and undefined', () => {
    expect(isNonNullable(null)).toBe(false);
    expect(isNonNullable(undefined)).toBe(false);
  });
});

describe('assertNonNullable', () => {
  it('does not throw for defined values', () => {
    expect(() => assertNonNullable(42)).not.toThrow();
    expect(() => assertNonNullable('')).not.toThrow();
  });

  it('throws for null with label', () => {
    expect(() => assertNonNullable(null, 'userId')).toThrow(
      'Expected non-nullable value for userId, got null',
    );
  });

  it('throws for undefined without label', () => {
    expect(() => assertNonNullable(undefined)).toThrow(
      'Expected non-nullable value, got undefined',
    );
  });
});

describe('isRecord', () => {
  it('returns true for plain objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ key: 'val' })).toBe(true);
  });

  it('returns false for non-objects', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('str')).toBe(false);
    expect(isRecord(42)).toBe(false);
  });
});

describe('assertType', () => {
  it('passes when guard returns true', () => {
    const isString = (v: unknown): v is string => typeof v === 'string';
    expect(() => assertType('hello', isString)).not.toThrow();
  });

  it('throws when guard returns false', () => {
    const isString = (v: unknown): v is string => typeof v === 'string';
    expect(() => assertType(123, isString, 'name')).toThrow(
      'Type assertion failed for name',
    );
  });
});

describe('exhaustiveCheck', () => {
  it('throws for unhandled values', () => {
    expect(() => exhaustiveCheck('unexpected' as never)).toThrow('Unhandled case: unexpected');
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
