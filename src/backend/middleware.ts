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
): MiddlewareRequestContext {
  counter += 1;
  return {
    requestId: `req-${Date.now()}-${counter}`,
    startedAt: Date.now(),
    path,
    method: method.toUpperCase(),
  };
}

export function getElapsedMs(ctx: MiddlewareRequestContext): number {
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
