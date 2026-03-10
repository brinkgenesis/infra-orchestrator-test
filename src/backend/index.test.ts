import { describe, it, expect } from 'vitest';
import {
  getServerUrl,
  getApiUrl,
  getHealthCheck,
  getHealthCheckUrl,
  createConfigFromEnv,
  buildRoute,
  validateConfig,
  mergeConfig,
  backendConfig,
} from './index';
import type { BackendConfig } from './index';

describe('backend config', () => {
  it('exports a valid default config', () => {
    expect(backendConfig).toBeDefined();
    expect(backendConfig.server.port).toBe(8080);
    expect(backendConfig.server.host).toBe('localhost');
    expect(backendConfig.api.basePath).toBe('/api');
    expect(backendConfig.api.versioned).toBe(true);
  });

  it('getServerUrl returns correct URL with default config', () => {
    expect(getServerUrl()).toBe('http://localhost:8080');
  });

  it('getServerUrl respects custom config', () => {
    const custom: BackendConfig = {
      server: { port: 3000, host: '0.0.0.0' },
      api: { basePath: '/api', versioned: false },
    };
    expect(getServerUrl(custom)).toBe('http://0.0.0.0:3000');
  });

  it('getApiUrl returns versioned URL by default', () => {
    expect(getApiUrl()).toBe('http://localhost:8080/api/v1');
  });

  it('getApiUrl returns unversioned URL when versioned is false', () => {
    const custom: BackendConfig = {
      server: { port: 8080, host: 'localhost' },
      api: { basePath: '/api', versioned: false },
    };
    expect(getApiUrl(custom)).toBe('http://localhost:8080/api');
  });
});

describe('health check', () => {
  it('getHealthCheck returns valid response', () => {
    const health = getHealthCheck('2.0.0');
    expect(health.status).toBe('ok');
    expect(health.version).toBe('2.0.0');
    expect(health.timestamp).toBeTruthy();
    expect(typeof health.uptime).toBe('number');
    expect(health.uptime).toBeGreaterThanOrEqual(0);
  });

  it('getHealthCheck uses default version', () => {
    const health = getHealthCheck();
    expect(health.version).toBe('1.0.0');
  });

  it('getHealthCheckUrl returns correct URL', () => {
    expect(getHealthCheckUrl()).toBe('http://localhost:8080/api/v1/health');
  });
});

describe('createConfigFromEnv', () => {
  it('uses defaults when env is empty', () => {
    const cfg = createConfigFromEnv({});
    expect(cfg.server.port).toBe(8080);
    expect(cfg.server.host).toBe('localhost');
    expect(cfg.api.basePath).toBe('/api');
    expect(cfg.api.versioned).toBe(true);
  });

  it('reads PORT and HOST from env', () => {
    const cfg = createConfigFromEnv({ PORT: '3000', HOST: '0.0.0.0' });
    expect(cfg.server.port).toBe(3000);
    expect(cfg.server.host).toBe('0.0.0.0');
  });

  it('reads API_BASE_PATH and API_VERSIONED from env', () => {
    const cfg = createConfigFromEnv({
      API_BASE_PATH: '/v2/api',
      API_VERSIONED: 'false',
    });
    expect(cfg.api.basePath).toBe('/v2/api');
    expect(cfg.api.versioned).toBe(false);
  });

  it('falls back to default port when PORT is not a valid number', () => {
    const cfg = createConfigFromEnv({ PORT: 'abc' });
    expect(cfg.server.port).toBe(8080);
  });
});

describe('buildRoute', () => {
  it('builds a route with segments', () => {
    expect(buildRoute(backendConfig, 'users', '123')).toBe(
      'http://localhost:8080/api/v1/users/123'
    );
  });

  it('strips leading/trailing slashes from segments', () => {
    expect(buildRoute(backendConfig, '/users/', '/123/')).toBe(
      'http://localhost:8080/api/v1/users/123'
    );
  });

  it('returns api url when no segments given', () => {
    expect(buildRoute(backendConfig)).toBe('http://localhost:8080/api/v1');
  });
});

describe('validateConfig', () => {
  it('returns no errors for valid config', () => {
    expect(validateConfig(backendConfig)).toEqual([]);
  });

  it('detects invalid port', () => {
    const cfg: BackendConfig = {
      server: { port: 0, host: 'localhost' },
      api: { basePath: '/api', versioned: true },
    };
    const errors = validateConfig(cfg);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Invalid port');
  });

  it('detects empty host', () => {
    const cfg: BackendConfig = {
      server: { port: 8080, host: '' },
      api: { basePath: '/api', versioned: true },
    };
    const errors = validateConfig(cfg);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Host must not be empty');
  });

  it('detects basePath not starting with /', () => {
    const cfg: BackendConfig = {
      server: { port: 8080, host: 'localhost' },
      api: { basePath: 'api', versioned: true },
    };
    const errors = validateConfig(cfg);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('basePath must start with');
  });
});

describe('mergeConfig', () => {
  it('returns default config when no overrides given', () => {
    const cfg = mergeConfig({});
    expect(cfg).toEqual(backendConfig);
  });

  it('overrides only server fields', () => {
    const cfg = mergeConfig({ server: { port: 3000 } });
    expect(cfg.server.port).toBe(3000);
    expect(cfg.server.host).toBe('localhost');
    expect(cfg.api).toEqual(backendConfig.api);
  });

  it('overrides only api fields', () => {
    const cfg = mergeConfig({ api: { versioned: false } });
    expect(cfg.api.versioned).toBe(false);
    expect(cfg.api.basePath).toBe('/api');
    expect(cfg.server).toEqual(backendConfig.server);
  });
});
