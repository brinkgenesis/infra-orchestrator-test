import { describe, it, expect } from 'vitest';
import {
  createMiddlewareStack,
  createCorsHeaders,
  isRateLimited,
  createRequestContext,
  getElapsedMs,
  resolveMiddlewareForConfig,
} from './middleware';
import type { BackendConfig, CorsConfig, RateLimitConfig } from './index';

describe('createMiddlewareStack', () => {
  it('returns defaults when no overrides given', () => {
    const stack = createMiddlewareStack();
    expect(stack.cors.allowedOrigins).toEqual(['*']);
    expect(stack.cors.allowedMethods).toContain('GET');
    expect(stack.rateLimit.windowMs).toBe(60_000);
    expect(stack.rateLimit.maxRequests).toBe(100);
    expect(stack.requestId).toBe(true);
    expect(stack.logging).toBe(true);
  });

  it('applies partial overrides', () => {
    const stack = createMiddlewareStack({ logging: false });
    expect(stack.logging).toBe(false);
    expect(stack.requestId).toBe(true);
  });

  it('applies cors override', () => {
    const cors: CorsConfig = {
      allowedOrigins: ['https://example.com'],
      allowedMethods: ['GET'],
      allowedHeaders: ['Content-Type'],
      maxAge: 3600,
    };
    const stack = createMiddlewareStack({ cors });
    expect(stack.cors.allowedOrigins).toEqual(['https://example.com']);
    expect(stack.cors.maxAge).toBe(3600);
  });
});

describe('createCorsHeaders', () => {
  it('returns wildcard origin when allowedOrigins includes *', () => {
    const cors: CorsConfig = {
      allowedOrigins: ['*'],
      allowedMethods: ['GET', 'POST'],
      allowedHeaders: ['Authorization'],
      maxAge: 7200,
    };
    const headers = createCorsHeaders(cors);
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST');
    expect(headers['Access-Control-Allow-Headers']).toBe('Authorization');
    expect(headers['Access-Control-Max-Age']).toBe('7200');
  });

  it('echoes matching request origin when not wildcard', () => {
    const cors: CorsConfig = {
      allowedOrigins: ['https://a.com', 'https://b.com'],
      allowedMethods: ['GET'],
      allowedHeaders: ['Content-Type'],
      maxAge: 3600,
    };
    const headers = createCorsHeaders(cors, 'https://a.com');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://a.com');
    expect(headers['Vary']).toBe('Origin');
  });

  it('omits Allow-Origin when request origin does not match', () => {
    const cors: CorsConfig = {
      allowedOrigins: ['https://a.com'],
      allowedMethods: ['GET'],
      allowedHeaders: ['Content-Type'],
      maxAge: 3600,
    };
    const headers = createCorsHeaders(cors, 'https://evil.com');
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('omits Allow-Origin when no request origin and not wildcard', () => {
    const cors: CorsConfig = {
      allowedOrigins: ['https://a.com'],
      allowedMethods: ['GET'],
      allowedHeaders: ['Content-Type'],
      maxAge: 3600,
    };
    const headers = createCorsHeaders(cors);
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('isRateLimited', () => {
  const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 10 };

  it('returns false when under limit', () => {
    expect(isRateLimited(5, config)).toBe(false);
  });

  it('returns false at exact limit', () => {
    expect(isRateLimited(10, config)).toBe(false);
  });

  it('returns true when over limit', () => {
    expect(isRateLimited(11, config)).toBe(true);
  });
});

describe('createRequestContext', () => {
  it('creates a context with correct fields', () => {
    const ctx = createRequestContext('/api/users', 'get');
    expect(ctx.path).toBe('/api/users');
    expect(ctx.method).toBe('GET');
    expect(ctx.requestId).toMatch(/^req-\d+-\d+$/);
    expect(typeof ctx.startedAt).toBe('number');
  });

  it('generates unique request IDs', () => {
    const ctx1 = createRequestContext('/a', 'get');
    const ctx2 = createRequestContext('/b', 'post');
    expect(ctx1.requestId).not.toBe(ctx2.requestId);
  });
});

describe('getElapsedMs', () => {
  it('returns non-negative elapsed time', () => {
    const ctx = createRequestContext('/test', 'get');
    const elapsed = getElapsedMs(ctx);
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });
});

describe('resolveMiddlewareForConfig', () => {
  it('uses defaults when config has no cors/rateLimit', () => {
    const cfg: BackendConfig = {
      server: { port: 8080, host: 'localhost' },
      api: { basePath: '/api', versioned: true },
    };
    const stack = resolveMiddlewareForConfig(cfg);
    expect(stack.cors.allowedOrigins).toEqual(['*']);
    expect(stack.rateLimit.maxRequests).toBe(100);
  });

  it('uses config cors when provided', () => {
    const cfg: BackendConfig = {
      server: { port: 8080, host: 'localhost' },
      api: { basePath: '/api', versioned: true },
      cors: {
        allowedOrigins: ['https://myapp.com'],
        allowedMethods: ['GET'],
        allowedHeaders: ['X-Custom'],
        maxAge: 1800,
      },
    };
    const stack = resolveMiddlewareForConfig(cfg);
    expect(stack.cors.allowedOrigins).toEqual(['https://myapp.com']);
  });
});
