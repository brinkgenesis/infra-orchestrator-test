import type { CorsConfig, RateLimitConfig, BackendConfig } from './index';

export interface MiddlewareStack {
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  requestId: boolean;
  logging: boolean;
}

export interface RequestContext {
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

/** Builds CORS response headers. Per the spec, Access-Control-Allow-Origin must be
 *  a single origin or '*', not a comma-separated list. When the config lists specific
 *  origins, pass the incoming request origin so the correct one can be echoed back. */
export function createCorsHeaders(cors: CorsConfig, requestOrigin?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': cors.allowedMethods.join(', '),
    'Access-Control-Allow-Headers': cors.allowedHeaders.join(', '),
    'Access-Control-Max-Age': String(cors.maxAge),
  };
  if (cors.allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (requestOrigin !== undefined && cors.allowedOrigins.includes(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

export function isRateLimited(
  requestCount: number,
  config: RateLimitConfig
): boolean {
  return requestCount > config.maxRequests;
}

let counter = 0;

export function createRequestContext(
  path: string,
  method: string
): RequestContext {
  counter += 1;
  return {
    requestId: `req-${Date.now()}-${counter}`,
    startedAt: Date.now(),
    path,
    method: method.toUpperCase(),
  };
}

export function getElapsedMs(ctx: RequestContext): number {
  return Date.now() - ctx.startedAt;
}

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
