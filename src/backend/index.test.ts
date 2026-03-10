import { describe, it, expect, beforeEach } from 'vitest';
import {
  getServerUrl,
  getApiUrl,
  getHealthCheck,
  getHealthCheckUrl,
  createConfigFromEnv,
  buildRoute,
  buildRouteWithQuery,
  validateConfig,
  mergeConfig,
  createRateLimiter,
  formatRoute,
  isHealthy,
  createMiddlewareConfig,
  isOriginAllowed,
  validateMiddlewareConfig,
  createRequestContext,
  resetRequestCounter,
  createErrorResponse,
  computeRetryDelay,
  shouldRetry,
  formatRequestLog,
  createEndpointRegistry,
  HTTP_STATUS,
  createSuccessResponse,
  createPaginatedResponse,
  validateRequest,
  isNonEmptyString,
  isPositiveNumber,
  parseIntParam,
  backendConfig,
  middlewareConfig,
} from './index';
import type { BackendConfig, CorsConfig, MiddlewareConfig, RetryConfig, ValidationRule } from './index';

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

describe('buildRouteWithQuery', () => {
  it('appends query parameters to route', () => {
    const url = buildRouteWithQuery(backendConfig, ['users'], { page: 1, limit: 20 });
    expect(url).toBe('http://localhost:8080/api/v1/users?page=1&limit=20');
  });

  it('encodes special characters in query values', () => {
    const url = buildRouteWithQuery(backendConfig, ['search'], { q: 'hello world' });
    expect(url).toBe('http://localhost:8080/api/v1/search?q=hello%20world');
  });

  it('returns base route when query is empty', () => {
    const url = buildRouteWithQuery(backendConfig, ['users'], {});
    expect(url).toBe('http://localhost:8080/api/v1/users');
  });

  it('supports boolean query values', () => {
    const url = buildRouteWithQuery(backendConfig, ['items'], { active: true });
    expect(url).toBe('http://localhost:8080/api/v1/items?active=true');
  });
});

describe('validateConfig edge cases', () => {
  it('detects NaN port', () => {
    const cfg: BackendConfig = {
      server: { port: NaN, host: 'localhost' },
      api: { basePath: '/api', versioned: true },
    };
    const errors = validateConfig(cfg);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Invalid port');
  });

  it('detects Infinity port', () => {
    const cfg: BackendConfig = {
      server: { port: Infinity, host: 'localhost' },
      api: { basePath: '/api', versioned: true },
    };
    const errors = validateConfig(cfg);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Invalid port');
  });

  it('reports multiple errors at once', () => {
    const cfg: BackendConfig = {
      server: { port: -1, host: '' },
      api: { basePath: 'no-slash', versioned: true },
    };
    const errors = validateConfig(cfg);
    expect(errors).toHaveLength(3);
  });
});

describe('createRateLimiter', () => {
  it('allows requests within the limit', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 3 });
    const r1 = limiter('client-1', 1000);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it('blocks requests exceeding the limit', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 2 });
    limiter('client-1', 1000);
    limiter('client-1', 1000);
    const r3 = limiter('client-1', 1000);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('resets after window expires', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 1 });
    limiter('client-1', 1000);
    const r2 = limiter('client-1', 1500);
    expect(r2.allowed).toBe(false);
    const r3 = limiter('client-1', 2001);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('tracks clients independently', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 1 });
    limiter('client-a', 1000);
    const rb = limiter('client-b', 1000);
    expect(rb.allowed).toBe(true);
  });
});

describe('formatRoute', () => {
  it('formats method and path', () => {
    expect(formatRoute('get', '/api/users')).toBe('GET /api/users');
  });

  it('uppercases the method', () => {
    expect(formatRoute('post', '/items')).toBe('POST /items');
  });
});

describe('isHealthy', () => {
  it('returns true for ok status', () => {
    expect(isHealthy({ status: 'ok', timestamp: '', uptime: 0, version: '1.0.0' })).toBe(true);
  });

  it('returns false for degraded status', () => {
    expect(isHealthy({ status: 'degraded', timestamp: '', uptime: 0, version: '1.0.0' })).toBe(false);
  });

  it('returns false for error status', () => {
    expect(isHealthy({ status: 'error', timestamp: '', uptime: 0, version: '1.0.0' })).toBe(false);
  });
});

describe('middleware config', () => {
  it('exports valid default middleware config', () => {
    expect(middlewareConfig).toBeDefined();
    expect(middlewareConfig.cors.allowedOrigins).toEqual(['*']);
    expect(middlewareConfig.cors.allowedMethods).toContain('GET');
    expect(middlewareConfig.cors.allowCredentials).toBe(false);
    expect(middlewareConfig.rateLimit.windowMs).toBe(60_000);
    expect(middlewareConfig.rateLimit.maxRequests).toBe(100);
    expect(middlewareConfig.requestLogging).toBe(true);
  });

  it('createMiddlewareConfig returns defaults with no overrides', () => {
    const cfg = createMiddlewareConfig();
    expect(cfg).toEqual(middlewareConfig);
  });

  it('createMiddlewareConfig merges cors overrides', () => {
    const cfg = createMiddlewareConfig({
      cors: { allowedOrigins: ['https://example.com'], allowedMethods: ['GET'], allowCredentials: true },
    });
    expect(cfg.cors.allowedOrigins).toEqual(['https://example.com']);
    expect(cfg.cors.allowCredentials).toBe(true);
    expect(cfg.rateLimit).toEqual(middlewareConfig.rateLimit);
  });

  it('createMiddlewareConfig merges rateLimit overrides', () => {
    const cfg = createMiddlewareConfig({
      rateLimit: { windowMs: 30_000, maxRequests: 50 },
    });
    expect(cfg.rateLimit.windowMs).toBe(30_000);
    expect(cfg.rateLimit.maxRequests).toBe(50);
    expect(cfg.cors).toEqual(middlewareConfig.cors);
  });

  it('createMiddlewareConfig overrides requestLogging', () => {
    const cfg = createMiddlewareConfig({ requestLogging: false });
    expect(cfg.requestLogging).toBe(false);
  });
});

describe('isOriginAllowed', () => {
  it('allows any origin when wildcard is present', () => {
    const cors: CorsConfig = { allowedOrigins: ['*'], allowedMethods: ['GET'], allowCredentials: false };
    expect(isOriginAllowed(cors, 'https://anything.com')).toBe(true);
  });

  it('allows listed origins', () => {
    const cors: CorsConfig = { allowedOrigins: ['https://example.com'], allowedMethods: ['GET'], allowCredentials: false };
    expect(isOriginAllowed(cors, 'https://example.com')).toBe(true);
  });

  it('rejects unlisted origins', () => {
    const cors: CorsConfig = { allowedOrigins: ['https://example.com'], allowedMethods: ['GET'], allowCredentials: false };
    expect(isOriginAllowed(cors, 'https://evil.com')).toBe(false);
  });
});

describe('validateMiddlewareConfig', () => {
  it('returns no errors for valid config', () => {
    expect(validateMiddlewareConfig(middlewareConfig)).toEqual([]);
  });

  it('detects empty allowedOrigins', () => {
    const cfg = createMiddlewareConfig({ cors: { allowedOrigins: [], allowedMethods: ['GET'], allowCredentials: false } });
    const errors = validateMiddlewareConfig(cfg);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('allowedOrigins');
  });

  it('detects empty allowedMethods', () => {
    const cfg = createMiddlewareConfig({ cors: { allowedOrigins: ['*'], allowedMethods: [], allowCredentials: false } });
    const errors = validateMiddlewareConfig(cfg);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('allowedMethods');
  });

  it('detects non-positive windowMs', () => {
    const cfg = createMiddlewareConfig({ rateLimit: { windowMs: 0, maxRequests: 100 } });
    const errors = validateMiddlewareConfig(cfg);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('windowMs');
  });

  it('detects non-positive maxRequests', () => {
    const cfg = createMiddlewareConfig({ rateLimit: { windowMs: 60_000, maxRequests: -1 } });
    const errors = validateMiddlewareConfig(cfg);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('maxRequests');
  });
});

describe('createRequestContext', () => {
  beforeEach(() => {
    resetRequestCounter();
  });

  it('creates a context with uppercase method', () => {
    const ctx = createRequestContext('get', '/api/users');
    expect(ctx.method).toBe('GET');
    expect(ctx.path).toBe('/api/users');
    expect(ctx.requestId).toMatch(/^req-\d+-\d+$/);
    expect(ctx.timestamp).toBeTruthy();
    expect(ctx.clientIp).toBeUndefined();
  });

  it('includes clientIp when provided', () => {
    const ctx = createRequestContext('post', '/api/items', '192.168.1.1');
    expect(ctx.clientIp).toBe('192.168.1.1');
  });

  it('generates unique request IDs', () => {
    const ctx1 = createRequestContext('get', '/a');
    const ctx2 = createRequestContext('get', '/b');
    expect(ctx1.requestId).not.toBe(ctx2.requestId);
  });
});

describe('createErrorResponse', () => {
  it('creates a basic error response', () => {
    const res = createErrorResponse('NOT_FOUND', 'Resource not found');
    expect(res.error.code).toBe('NOT_FOUND');
    expect(res.error.message).toBe('Resource not found');
    expect(res.requestId).toBeUndefined();
    expect(res.error.details).toBeUndefined();
  });

  it('includes requestId when provided', () => {
    const res = createErrorResponse('BAD_REQUEST', 'Invalid input', 'req-123');
    expect(res.requestId).toBe('req-123');
  });

  it('includes details when provided', () => {
    const res = createErrorResponse('VALIDATION', 'Failed', undefined, { field: 'email' });
    expect(res.error.details).toEqual({ field: 'email' });
    expect(res.requestId).toBeUndefined();
  });
});

describe('retry utilities', () => {
  const retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
  };

  it('computeRetryDelay uses exponential backoff', () => {
    expect(computeRetryDelay(0, retryConfig)).toBe(100);
    expect(computeRetryDelay(1, retryConfig)).toBe(200);
    expect(computeRetryDelay(2, retryConfig)).toBe(400);
  });

  it('computeRetryDelay caps at maxDelayMs', () => {
    expect(computeRetryDelay(10, retryConfig)).toBe(5000);
  });

  it('computeRetryDelay returns 0 for negative attempt', () => {
    expect(computeRetryDelay(-1, retryConfig)).toBe(0);
  });

  it('shouldRetry returns true when under max', () => {
    expect(shouldRetry(0, retryConfig)).toBe(true);
    expect(shouldRetry(2, retryConfig)).toBe(true);
  });

  it('shouldRetry returns false at or beyond max', () => {
    expect(shouldRetry(3, retryConfig)).toBe(false);
    expect(shouldRetry(4, retryConfig)).toBe(false);
  });
});

describe('formatRequestLog', () => {
  beforeEach(() => {
    resetRequestCounter();
  });

  it('formats log without clientIp', () => {
    const ctx = createRequestContext('get', '/api/test');
    const log = formatRequestLog(ctx);
    expect(log).toContain('GET /api/test');
    expect(log).toContain(ctx.requestId);
    expect(log).not.toContain('from');
  });

  it('formats log with clientIp', () => {
    const ctx = createRequestContext('post', '/api/data', '10.0.0.1');
    const log = formatRequestLog(ctx);
    expect(log).toContain('POST /api/data');
    expect(log).toContain('from 10.0.0.1');
  });
});

describe('createEndpointRegistry', () => {
  it('registers and lists endpoints', () => {
    const registry = createEndpointRegistry();
    registry.register('get', '/users', 'List users');
    registry.register('post', '/users', 'Create user');
    expect(registry.count()).toBe(2);
    expect(registry.list()).toHaveLength(2);
  });

  it('normalizes method to uppercase and adds leading slash', () => {
    const registry = createEndpointRegistry();
    registry.register('get', 'items', 'List items');
    const ep = registry.find('GET', '/items');
    expect(ep).toBeDefined();
    expect(ep!.method).toBe('GET');
    expect(ep!.path).toBe('/items');
  });

  it('prevents duplicate registrations', () => {
    const registry = createEndpointRegistry();
    registry.register('get', '/users', 'List users');
    registry.register('GET', '/users', 'List users again');
    expect(registry.count()).toBe(1);
  });

  it('find returns undefined for missing endpoint', () => {
    const registry = createEndpointRegistry();
    expect(registry.find('DELETE', '/nothing')).toBeUndefined();
  });
});

describe('HTTP_STATUS', () => {
  it('contains standard status codes', () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.CREATED).toBe(201);
    expect(HTTP_STATUS.NO_CONTENT).toBe(204);
    expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(HTTP_STATUS.FORBIDDEN).toBe(403);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS.CONFLICT).toBe(409);
    expect(HTTP_STATUS.RATE_LIMITED).toBe(429);
    expect(HTTP_STATUS.INTERNAL_ERROR).toBe(500);
    expect(HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503);
  });
});

describe('createSuccessResponse', () => {
  it('creates a basic success response with data', () => {
    const res = createSuccessResponse({ id: 1, name: 'test' });
    expect(res.data).toEqual({ id: 1, name: 'test' });
    expect(res.requestId).toBeUndefined();
    expect(res.meta).toBeUndefined();
  });

  it('includes requestId when provided', () => {
    const res = createSuccessResponse('hello', 'req-456');
    expect(res.data).toBe('hello');
    expect(res.requestId).toBe('req-456');
  });

  it('includes meta when provided', () => {
    const res = createSuccessResponse([1, 2], undefined, { cached: true });
    expect(res.data).toEqual([1, 2]);
    expect(res.meta).toEqual({ cached: true });
    expect(res.requestId).toBeUndefined();
  });
});

describe('createPaginatedResponse', () => {
  it('creates a paginated response with correct pagination info', () => {
    const res = createPaginatedResponse(['a', 'b'], 1, 10, 25);
    expect(res.data).toEqual(['a', 'b']);
    expect(res.pagination.page).toBe(1);
    expect(res.pagination.pageSize).toBe(10);
    expect(res.pagination.total).toBe(25);
    expect(res.pagination.totalPages).toBe(3);
  });

  it('handles zero total', () => {
    const res = createPaginatedResponse([], 1, 10, 0);
    expect(res.data).toEqual([]);
    expect(res.pagination.totalPages).toBe(0);
  });

  it('handles zero pageSize', () => {
    const res = createPaginatedResponse([], 1, 0, 10);
    expect(res.pagination.totalPages).toBe(0);
  });

  it('includes requestId when provided', () => {
    const res = createPaginatedResponse([1], 1, 10, 1, 'req-pg');
    expect(res.requestId).toBe('req-pg');
  });

  it('calculates totalPages correctly for exact division', () => {
    const res = createPaginatedResponse([1, 2], 1, 5, 20);
    expect(res.pagination.totalPages).toBe(4);
  });
});

describe('validateRequest', () => {
  const rules: ValidationRule[] = [
    { field: 'name', check: isNonEmptyString, message: 'Name is required' },
    { field: 'age', check: isPositiveNumber, message: 'Age must be positive' },
  ];

  it('returns valid for correct input', () => {
    const result = validateRequest({ name: 'Alice', age: 30 }, rules);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for missing fields', () => {
    const result = validateRequest({}, rules);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('returns error for invalid field', () => {
    const result = validateRequest({ name: '', age: 25 }, rules);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.field).toBe('name');
  });

  it('returns valid with empty rules', () => {
    const result = validateRequest({ anything: true }, []);
    expect(result.valid).toBe(true);
  });
});

describe('isNonEmptyString', () => {
  it('returns true for non-empty string', () => {
    expect(isNonEmptyString('hello')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isNonEmptyString('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(isNonEmptyString('   ')).toBe(false);
  });

  it('returns false for non-string', () => {
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
  });
});

describe('isPositiveNumber', () => {
  it('returns true for positive number', () => {
    expect(isPositiveNumber(5)).toBe(true);
    expect(isPositiveNumber(0.1)).toBe(true);
  });

  it('returns false for zero', () => {
    expect(isPositiveNumber(0)).toBe(false);
  });

  it('returns false for negative number', () => {
    expect(isPositiveNumber(-1)).toBe(false);
  });

  it('returns false for NaN and Infinity', () => {
    expect(isPositiveNumber(NaN)).toBe(false);
    expect(isPositiveNumber(Infinity)).toBe(false);
  });

  it('returns false for non-number', () => {
    expect(isPositiveNumber('5')).toBe(false);
  });
});

describe('parseIntParam', () => {
  it('parses valid integer string', () => {
    expect(parseIntParam('42', 0)).toBe(42);
  });

  it('returns fallback for undefined', () => {
    expect(parseIntParam(undefined, 10)).toBe(10);
  });

  it('returns fallback for non-numeric string', () => {
    expect(parseIntParam('abc', 5)).toBe(5);
  });

  it('parses negative numbers', () => {
    expect(parseIntParam('-3', 0)).toBe(-3);
  });

  it('truncates decimal strings', () => {
    expect(parseIntParam('3.9', 0)).toBe(3);
  });
});
