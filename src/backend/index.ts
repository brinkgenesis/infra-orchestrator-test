import { AppConfig, defaultConfig as appDefaultConfig } from '../index';

export interface ServerStatus {
  running: boolean;
  uptime: number;
  requestCount: number;
}

export interface RouteHandler {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (req: unknown) => Promise<unknown>;
}

/** Creates and returns a default (stopped) server status object. */
export function createServerStatus(): ServerStatus {
  return {
    running: false,
    uptime: 0,
    requestCount: 0,
  };
}

/** Returns the HTTP address string for the given application config. */
export function getServerAddress(config: AppConfig = appDefaultConfig): string {
  return `http://${config.host}:${config.port}`;
}

/** Returns true if the application config represents a production environment. */
export function isProduction(config: AppConfig = appDefaultConfig): boolean {
  return config.env === 'production';
}

export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface BackendConfig {
  server: {
    port: number;
    host: string;
  };
  api: {
    basePath: string;
    versioned: boolean;
  };
  cors?: CorsConfig;
  rateLimit?: RateLimitConfig;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
}

const defaultConfig: BackendConfig = {
  server: {
    port: 8080,
    host: 'localhost',
  },
  api: {
    basePath: '/api',
    versioned: true,
  },
};

const startTime = Date.now();

/** Returns the base server URL built from the backend config. */
export function getServerUrl(cfg: BackendConfig = defaultConfig): string {
  return `http://${cfg.server.host}:${cfg.server.port}`;
}

/** Returns the versioned or non-versioned API base URL built from the backend config. */
export function getApiUrl(cfg: BackendConfig = defaultConfig): string {
  const base = getServerUrl(cfg);
  return cfg.api.versioned
    ? `${base}${cfg.api.basePath}/v1`
    : `${base}${cfg.api.basePath}`;
}

/** Returns a health check response with current uptime and the given version string. */
export function getHealthCheck(version = '1.0.0'): HealthCheckResponse {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version,
  };
}

/** Returns the full URL to the health check endpoint for the given config. */
export function getHealthCheckUrl(cfg: BackendConfig = defaultConfig): string {
  return `${getApiUrl(cfg)}/health`;
}

/** Builds a BackendConfig by reading PORT, HOST, API_BASE_PATH, and API_VERSIONED from the environment map. */
export function createConfigFromEnv(env: Record<string, string | undefined>): BackendConfig {
  const parsedPort = env['PORT'] ? parseInt(env['PORT'], 10) : NaN;
  const isValidPort = Number.isFinite(parsedPort) && parsedPort >= 1 && parsedPort <= 65535;
  return {
    server: {
      port: isValidPort ? parsedPort : defaultConfig.server.port,
      host: env['HOST'] || defaultConfig.server.host,
    },
    api: {
      basePath: env['API_BASE_PATH'] || defaultConfig.api.basePath,
      versioned: env['API_VERSIONED'] !== 'false',
    },
  };
}

/** Joins the given path segments onto the API base URL derived from the config. */
export function buildRoute(cfg: BackendConfig, ...segments: string[]): string {
  const apiUrl = getApiUrl(cfg);
  const joined = segments
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return joined ? `${apiUrl}/${joined}` : apiUrl;
}

/** Validates a BackendConfig and returns an array of human-readable error messages. */
export function validateConfig(cfg: BackendConfig): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(cfg.server.port) || cfg.server.port < 1 || cfg.server.port > 65535) {
    errors.push(`Invalid port: ${cfg.server.port}. Must be between 1 and 65535.`);
  }
  if (!cfg.server.host) {
    errors.push('Host must not be empty.');
  }
  if (!cfg.api.basePath.startsWith('/')) {
    errors.push(`basePath must start with "/". Got: "${cfg.api.basePath}".`);
  }
  return errors;
}

/** Merges the provided server and api overrides onto the default backend config. */
export function mergeConfig(overrides: Partial<{
  server: Partial<BackendConfig['server']>;
  api: Partial<BackendConfig['api']>;
}>): BackendConfig {
  return {
    server: {
      ...defaultConfig.server,
      ...overrides.server,
    },
    api: {
      ...defaultConfig.api,
      ...overrides.api,
    },
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export type RateLimiterFn = {
  (clientId: string, now?: number): RateLimitResult;
  cleanup(now?: number): number;
  size(): number;
};

/** Creates a stateful rate-limiter function that tracks request counts per client ID within sliding windows. */
export function createRateLimiter(config: RateLimitConfig): RateLimiterFn {
  const windows = new Map<string, { count: number; resetAt: number }>();

  function checkRate(clientId: string, now = Date.now()): RateLimitResult {
    const entry = windows.get(clientId);

    if (!entry || now >= entry.resetAt) {
      const resetAt = now + config.windowMs;
      windows.set(clientId, { count: 1, resetAt });
      return { allowed: true, remaining: config.maxRequests - 1, resetAt };
    }

    entry.count += 1;
    const allowed = entry.count <= config.maxRequests;
    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetAt: entry.resetAt,
    };
  }

  checkRate.cleanup = function cleanup(now = Date.now()): number {
    let removed = 0;
    for (const [key, entry] of windows) {
      if (now >= entry.resetAt) {
        windows.delete(key);
        removed++;
      }
    }
    return removed;
  };

  checkRate.size = function size(): number {
    return windows.size;
  };

  return checkRate;
}

/** Builds a route URL with the given path segments and appends the query parameters as a query string. */
export function buildRouteWithQuery(
  cfg: BackendConfig,
  segments: string[],
  query: Record<string, string | number | boolean>,
): string {
  const base = buildRoute(cfg, ...segments);
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return params ? `${base}?${params}` : base;
}

/** Formats an HTTP method and path into a canonical uppercase string, e.g. "GET /users". */
export function formatRoute(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/** Returns true if the health check response status is "ok". */
export function isHealthy(health: HealthCheckResponse): boolean {
  return health.status === 'ok';
}

export interface MiddlewareConfig {
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  requestLogging: boolean;
}

const defaultMiddlewareConfig: MiddlewareConfig = {
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    allowCredentials: false,
    maxAge: 86400,
  },
  rateLimit: {
    windowMs: 60_000,
    maxRequests: 100,
  },
  requestLogging: true,
};

/** Creates a middleware config by merging the provided overrides with the default middleware config. */
export function createMiddlewareConfig(
  overrides: Partial<MiddlewareConfig> = {}
): MiddlewareConfig {
  return {
    cors: { ...defaultMiddlewareConfig.cors, ...overrides.cors },
    rateLimit: { ...defaultMiddlewareConfig.rateLimit, ...overrides.rateLimit },
    requestLogging: overrides.requestLogging ?? defaultMiddlewareConfig.requestLogging,
  };
}

/** Returns true if the given origin is allowed by the CORS config (including wildcard support). */
export function isOriginAllowed(cors: CorsConfig, origin: string): boolean {
  if (cors.allowedOrigins.includes('*')) return true;
  return cors.allowedOrigins.includes(origin);
}

/** Validates a MiddlewareConfig and returns an array of human-readable error messages. */
export function validateMiddlewareConfig(cfg: MiddlewareConfig): string[] {
  const errors: string[] = [];
  if (cfg.cors.allowedOrigins.length === 0) {
    errors.push('CORS allowedOrigins must not be empty.');
  }
  if (cfg.cors.allowedMethods.length === 0) {
    errors.push('CORS allowedMethods must not be empty.');
  }
  if (cfg.rateLimit.windowMs <= 0) {
    errors.push(`rateLimit windowMs must be positive. Got: ${cfg.rateLimit.windowMs}.`);
  }
  if (cfg.rateLimit.maxRequests <= 0) {
    errors.push(`rateLimit maxRequests must be positive. Got: ${cfg.rateLimit.maxRequests}.`);
  }
  return errors;
}

export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  timestamp: string;
  clientIp?: string;
}

let requestCounter = 0;

/** Creates a new request context with a unique ID, normalised method, and optional client IP. */
export function createRequestContext(
  method: string,
  path: string,
  clientIp?: string,
): RequestContext {
  requestCounter += 1;
  const ctx: RequestContext = {
    requestId: `req-${Date.now()}-${requestCounter}`,
    method: method.toUpperCase(),
    path,
    timestamp: new Date().toISOString(),
  };
  if (clientIp !== undefined) {
    ctx.clientIp = clientIp;
  }
  return ctx;
}

/** Resets the global request counter to zero (useful in tests). */
export function resetRequestCounter(): void {
  requestCounter = 0;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

/** Constructs a structured API error response from the given code, message, and optional metadata. */
export function createErrorResponse(
  code: string,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>,
): ApiErrorResponse {
  const response: ApiErrorResponse = {
    error: { code, message },
  };
  if (requestId) response.requestId = requestId;
  if (details) response.error.details = details;
  return response;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/** Computes the capped exponential back-off delay in milliseconds for the given attempt number. */
export function computeRetryDelay(
  attempt: number,
  config: RetryConfig,
): number {
  if (attempt < 0) return 0;
  const delay = config.baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/** Returns true if another retry attempt should be made according to the retry config. */
export function shouldRetry(attempt: number, config: RetryConfig): boolean {
  return attempt < config.maxRetries;
}

/** Formats a request context into a single-line log string. */
export function formatRequestLog(ctx: RequestContext): string {
  const ip = ctx.clientIp ? ` from ${ctx.clientIp}` : '';
  return `[${ctx.timestamp}] ${ctx.requestId} ${ctx.method} ${ctx.path}${ip}`;
}

export interface EndpointDef {
  method: string;
  path: string;
  description: string;
}

/** Creates an in-memory endpoint registry with register, list, find, and count operations. */
export function createEndpointRegistry() {
  const endpoints: EndpointDef[] = [];

  return {
    register(method: string, path: string, description: string): void {
      const normalized: EndpointDef = {
        method: method.toUpperCase(),
        path: path.startsWith('/') ? path : `/${path}`,
        description,
      };
      const exists = endpoints.some(
        (e) => e.method === normalized.method && e.path === normalized.path,
      );
      if (!exists) {
        endpoints.push(normalized);
      }
    },
    list(): ReadonlyArray<EndpointDef> {
      return [...endpoints];
    },
    find(method: string, path: string): EndpointDef | undefined {
      return endpoints.find(
        (e) => e.method === method.toUpperCase() && e.path === path,
      );
    },
    count(): number {
      return endpoints.length;
    },
  };
}

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

export interface ApiSuccessResponse<T> {
  data: T;
  requestId?: string;
  meta?: Record<string, unknown>;
}

/** Wraps the given data in a standardised API success response envelope. */
export function createSuccessResponse<T>(
  data: T,
  requestId?: string,
  meta?: Record<string, unknown>,
): ApiSuccessResponse<T> {
  const response: ApiSuccessResponse<T> = { data };
  if (requestId) response.requestId = requestId;
  if (meta) response.meta = meta;
  return response;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  requestId?: string;
}

/** Wraps the given data slice in a paginated response envelope with computed totalPages. */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
  requestId?: string,
): PaginatedResponse<T> {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  const response: PaginatedResponse<T> = {
    data,
    pagination: { page, pageSize, total, totalPages },
  };
  if (requestId) response.requestId = requestId;
  return response;
}

export interface ValidationRule {
  field: string;
  check: (value: unknown) => boolean;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
}

/** Validates a request body against an array of rules and returns aggregated validation errors. */
export function validateRequest(
  body: Record<string, unknown>,
  rules: ValidationRule[],
): ValidationResult {
  const errors: Array<{ field: string; message: string }> = [];
  for (const rule of rules) {
    const value = body[rule.field];
    if (!rule.check(value)) {
      errors.push({ field: rule.field, message: rule.message });
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Returns true if the given value is a non-empty string. */
export function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Returns true if the given value is a finite positive number. */
export function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Parses a string as an integer, returning the fallback when the value is undefined or not a valid integer. */
export function parseIntParam(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export { defaultConfig as backendConfig, defaultMiddlewareConfig as middlewareConfig };
