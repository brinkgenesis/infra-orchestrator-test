import { describe, it, expect } from 'vitest';
import { getHealthStatus, buildBaseUrl, mapHealthStatusToHttpCode, createHealthChecker } from './health';
import type { HealthStatus, DetailedHealthStatus } from './health';
import type { AppConfig } from '../index';

describe('getHealthStatus', () => {
  it('should return a healthy status', () => {
    const status = getHealthStatus();
    expect(status.status).toBe('healthy');
  });

  it('should use default version 0.1.0', () => {
    const status = getHealthStatus();
    expect(status.version).toBe('0.1.0');
  });

  it('should accept a custom version string', () => {
    const status = getHealthStatus('2.0.0');
    expect(status.version).toBe('2.0.0');
  });

  it('should return a valid ISO timestamp', () => {
    const status = getHealthStatus();
    expect(() => new Date(status.timestamp)).not.toThrow();
    expect(new Date(status.timestamp).toISOString()).toBe(status.timestamp);
  });

  it('should return non-negative uptime', () => {
    const status = getHealthStatus();
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should satisfy the HealthStatus interface', () => {
    const status: HealthStatus = getHealthStatus();
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('uptime');
    expect(status).toHaveProperty('timestamp');
    expect(status).toHaveProperty('version');
  });
});

describe('buildBaseUrl', () => {
  it('should build a correct URL from config', () => {
    const config: AppConfig = { port: 8080, host: '0.0.0.0', env: 'production' };
    expect(buildBaseUrl(config)).toBe('http://0.0.0.0:8080');
  });

  it('should use localhost for default-like config', () => {
    const config: AppConfig = { port: 3000, host: 'localhost', env: 'development' };
    expect(buildBaseUrl(config)).toBe('http://localhost:3000');
  });
});

describe('mapHealthStatusToHttpCode', () => {
  it('returns 200 for healthy', () => {
    expect(mapHealthStatusToHttpCode('healthy')).toBe(200);
  });

  it('returns 207 for degraded', () => {
    expect(mapHealthStatusToHttpCode('degraded')).toBe(207);
  });

  it('returns 503 for unhealthy', () => {
    expect(mapHealthStatusToHttpCode('unhealthy')).toBe(503);
  });
});

describe('createHealthChecker', () => {
  it('should return healthy when no probes are registered', async () => {
    const checker = createHealthChecker();
    const result = await checker.check();
    expect(result.status).toBe('healthy');
    expect(result.dependencies).toEqual([]);
  });

  it('should accept a custom version', async () => {
    const checker = createHealthChecker();
    const result = await checker.check('3.0.0');
    expect(result.version).toBe('3.0.0');
  });

  it('should register and list probes', () => {
    const checker = createHealthChecker();
    checker.register('db', () => true);
    checker.register('cache', () => true);
    expect(checker.list()).toEqual(['db', 'cache']);
  });

  it('should unregister a probe', () => {
    const checker = createHealthChecker();
    checker.register('db', () => true);
    expect(checker.unregister('db')).toBe(true);
    expect(checker.list()).toEqual([]);
  });

  it('should return false when unregistering a non-existent probe', () => {
    const checker = createHealthChecker();
    expect(checker.unregister('missing')).toBe(false);
  });

  it('should report healthy when all probes are up', async () => {
    const checker = createHealthChecker();
    checker.register('db', () => true);
    checker.register('cache', () => Promise.resolve(true));
    const result = await checker.check();
    expect(result.status).toBe('healthy');
    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0]!.status).toBe('up');
    expect(result.dependencies[1]!.status).toBe('up');
  });

  it('should report degraded when some probes are down', async () => {
    const checker = createHealthChecker();
    checker.register('db', () => true);
    checker.register('cache', () => false);
    const result = await checker.check();
    expect(result.status).toBe('degraded');
    expect(result.dependencies.find((d) => d.name === 'db')!.status).toBe('up');
    expect(result.dependencies.find((d) => d.name === 'cache')!.status).toBe('down');
  });

  it('should report unhealthy when all probes are down', async () => {
    const checker = createHealthChecker();
    checker.register('db', () => false);
    checker.register('cache', () => false);
    const result = await checker.check();
    expect(result.status).toBe('unhealthy');
  });

  it('should handle probe exceptions as down with error message', async () => {
    const checker = createHealthChecker();
    checker.register('db', () => {
      throw new Error('Connection refused');
    });
    const result = await checker.check();
    expect(result.status).toBe('unhealthy');
    expect(result.dependencies[0]!.status).toBe('down');
    expect(result.dependencies[0]!.message).toBe('Connection refused');
  });

  it('should handle async probe rejections as down', async () => {
    const checker = createHealthChecker();
    checker.register('api', () => Promise.reject(new Error('Timeout')));
    const result = await checker.check();
    expect(result.dependencies[0]!.status).toBe('down');
    expect(result.dependencies[0]!.message).toBe('Timeout');
  });

  it('should handle non-Error throws with generic message', async () => {
    const checker = createHealthChecker();
    checker.register('svc', () => {
      throw 'string error';
    });
    const result = await checker.check();
    expect(result.dependencies[0]!.status).toBe('down');
    expect(result.dependencies[0]!.message).toBe('Unknown error');
  });

  it('should track latency for each probe', async () => {
    const checker = createHealthChecker();
    checker.register('db', () => true);
    const result = await checker.check();
    expect(result.dependencies[0]!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should include uptime and timestamp in detailed result', async () => {
    const checker = createHealthChecker();
    const result: DetailedHealthStatus = await checker.check();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('should overwrite probe when registering same name', async () => {
    const checker = createHealthChecker();
    checker.register('db', () => false);
    checker.register('db', () => true);
    const result = await checker.check();
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]!.status).toBe('up');
  });
});
