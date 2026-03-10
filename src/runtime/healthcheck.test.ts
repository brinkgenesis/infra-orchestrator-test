import { describe, it, expect } from 'vitest';
import { HealthChecker } from './healthcheck';

describe('HealthChecker', () => {
  it('reports healthy when no checks registered', async () => {
    const checker = new HealthChecker();
    const result = await checker.status();
    expect(result.healthy).toBe(true);
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(Object.keys(result.checks)).toHaveLength(0);
  });

  it('reports healthy when all checks pass', async () => {
    const checker = new HealthChecker();
    checker.register('db', async () => ({ ok: true }));
    checker.register('cache', async () => ({ ok: true, message: 'connected' }));

    const result = await checker.status();
    expect(result.healthy).toBe(true);
    expect(result.checks['db']?.ok).toBe(true);
    expect(result.checks['cache']?.message).toBe('connected');
  });

  it('reports unhealthy when a check fails', async () => {
    const checker = new HealthChecker();
    checker.register('db', async () => ({ ok: false, message: 'connection refused' }));

    const result = await checker.status();
    expect(result.healthy).toBe(false);
    expect(result.checks['db']?.message).toBe('connection refused');
  });

  it('catches thrown errors in checks', async () => {
    const checker = new HealthChecker();
    checker.register('broken', async () => {
      throw new Error('boom');
    });

    const result = await checker.status();
    expect(result.healthy).toBe(false);
    expect(result.checks['broken']?.ok).toBe(false);
    expect(result.checks['broken']?.message).toBe('boom');
  });

  it('supports unregistering checks', async () => {
    const checker = new HealthChecker();
    checker.register('temp', async () => ({ ok: true }));
    checker.unregister('temp');

    const result = await checker.status();
    expect(Object.keys(result.checks)).toHaveLength(0);
  });
});
