import type { CorsConfig, RateLimitConfig, BackendConfig } from './index';

export interface MiddlewareStack {
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  requestId: boolean;
  logging: boolean;
}

export interface MiddlewareRequestContext {
  requestId: string;
  startedAt: number;
  path: string;
  method: string;
}

const defaultCors: CorsConfig = {
  allowedOrigins: ['*'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};

const defaultRateLimit: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 100,
};

/** Creates a middleware stack configuration, merging any provided overrides with defaults. */
export function createMiddlewareStack(
  overrides?: Partial<MiddlewareStack>
): MiddlewareStack {
  return {
    cors: overrides?.cors ?? defaultCors,
    rateLimit: overrides?.rateLimit ?? defaultRateLimit,
    requestId: overrides?.requestId ?? true,
    logging: overrides?.logging ?? true,
  };
}

/** Builds a map of CORS response headers based on the CORS config and optional incoming origin. */
export function createCorsHeaders(cors: CorsConfig, requestOrigin?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': cors.allowedMethods.join(', '),
    'Access-Control-Allow-Headers': (cors.allowedHeaders ?? []).join(', '),
    'Access-Control-Max-Age': String(cors.maxAge ?? 0),
  };
  if (cors.allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (requestOrigin !== undefined && cors.allowedOrigins.includes(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

/** Returns true if the given request count has exceeded the rate limit. */
export function isRateLimited(
  requestCount: number,
  config: RateLimitConfig
): boolean {
  return requestCount > config.maxRequests;
}

let counter = 0;

/** Creates a new middleware request context with a unique request ID and start timestamp. */
export function createRequestContext(
  path: string,
  method: string
): MiddlewareRequestContext {
  counter += 1;
  return {
    requestId: `req-${Date.now()}-${counter}`,
    startedAt: Date.now(),
    path,
    method: method.toUpperCase(),
  };
}

/** Returns the number of milliseconds elapsed since the request context was created. */
export function getElapsedMs(ctx: MiddlewareRequestContext): number {
  return Date.now() - ctx.startedAt;
}

/** Resolves the appropriate middleware stack from a backend config, applying cors and rate-limit overrides. */
export function resolveMiddlewareForConfig(
  cfg: BackendConfig
): MiddlewareStack {
  const overrides: Partial<MiddlewareStack> = {};
  if (cfg.cors !== undefined) {
    overrides.cors = cfg.cors;
  }
  if (cfg.rateLimit !== undefined) {
    overrides.rateLimit = cfg.rateLimit;
  }
  return createMiddlewareStack(overrides);
}
