import { describe, it, expect } from 'vitest';
import { getHealthStatus, buildBaseUrl, mapHealthStatusToHttpCode } from './health';
import type { HealthStatus } from './health';
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
