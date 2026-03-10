import { describe, it, expect } from 'vitest';
import {
  getServerUrl,
  getApiUrl,
  getHealthCheck,
  getHealthCheckUrl,
  createConfigFromEnv,
  buildRoute,
  validateConfig,
  backendConfig,
  getCorsConfig,
  getRateLimitConfig,
  createRouteNamespace,
  createRequestContext,
  mergeConfig,
} from './index';
import type { BackendConfig, CorsConfig, RateLimitConfig } from './index';

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

describe('getCorsConfig', () => {
  it('returns default CORS config when none specified', () => {
    const cors = getCorsConfig(backendConfig);
    expect(cors.allowedOrigins).toEqual(['*']);
    expect(cors.allowedMethods).toContain('GET');
    expect(cors.allowedMethods).toContain('POST');
    expect(cors.allowedHeaders).toContain('Content-Type');
    expect(cors.maxAge).toBe(86400);
  });

  it('returns custom CORS config when provided', () => {
    const custom: CorsConfig = {
      allowedOrigins: ['https://example.com'],
      allowedMethods: ['GET'],
      allowedHeaders: ['X-Custom'],
      maxAge: 3600,
    };
    const cfg: BackendConfig = {
      ...backendConfig,
      cors: custom,
    };
    const cors = getCorsConfig(cfg);
    expect(cors.allowedOrigins).toEqual(['https://example.com']);
    expect(cors.maxAge).toBe(3600);
  });
});

describe('getRateLimitConfig', () => {
  it('returns default rate limit config when none specified', () => {
    const rl = getRateLimitConfig(backendConfig);
    expect(rl.windowMs).toBe(60_000);
    expect(rl.maxRequests).toBe(100);
  });

  it('returns custom rate limit config when provided', () => {
    const custom: RateLimitConfig = { windowMs: 30_000, maxRequests: 50 };
    const cfg: BackendConfig = { ...backendConfig, rateLimit: custom };
    const rl = getRateLimitConfig(cfg);
    expect(rl.windowMs).toBe(30_000);
    expect(rl.maxRequests).toBe(50);
  });
});

describe('createRouteNamespace', () => {
  it('creates a namespace with prefixed routes', () => {
    const ns = createRouteNamespace(backendConfig, 'users', ['list', 'create']);
    expect(ns.prefix).toBe('users');
    expect(ns.routes).toHaveLength(2);
    expect(ns.routes[0]).toBe('http://localhost:8080/api/v1/users/list');
    expect(ns.routes[1]).toBe('http://localhost:8080/api/v1/users/create');
  });

  it('strips slashes from prefix and routes', () => {
    const ns = createRouteNamespace(backendConfig, '/admin/', ['/dashboard/']);
    expect(ns.prefix).toBe('admin');
    expect(ns.routes[0]).toBe('http://localhost:8080/api/v1/admin/dashboard');
  });
});

describe('createRequestContext', () => {
  it('creates a request context with correct fields', () => {
    const ctx = createRequestContext('/api/users', 'get');
    expect(ctx.requestId).toMatch(/^req_[a-z0-9]{16}$/);
    expect(ctx.path).toBe('/api/users');
    expect(ctx.method).toBe('GET');
    expect(ctx.timestamp).toBeTruthy();
  });

  it('generates unique request IDs', () => {
    const ctx1 = createRequestContext('/a', 'get');
    const ctx2 = createRequestContext('/b', 'post');
    expect(ctx1.requestId).not.toBe(ctx2.requestId);
  });
});

describe('mergeConfig', () => {
  it('merges server overrides', () => {
    const merged = mergeConfig(backendConfig, { server: { port: 9090, host: '0.0.0.0' } });
    expect(merged.server.port).toBe(9090);
    expect(merged.server.host).toBe('0.0.0.0');
    expect(merged.api.basePath).toBe('/api');
  });

  it('merges api overrides', () => {
    const merged = mergeConfig(backendConfig, { api: { basePath: '/v2', versioned: false } });
    expect(merged.api.basePath).toBe('/v2');
    expect(merged.api.versioned).toBe(false);
    expect(merged.server.port).toBe(8080);
  });

  it('merges cors and rateLimit overrides', () => {
    const cors: CorsConfig = {
      allowedOrigins: ['https://app.com'],
      allowedMethods: ['GET'],
      allowedHeaders: ['Authorization'],
      maxAge: 1800,
    };
    const merged = mergeConfig(backendConfig, { cors });
    expect(merged.cors).toEqual(cors);
  });
});
