export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge: number;
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

export function getServerUrl(cfg: BackendConfig = defaultConfig): string {
  return `http://${cfg.server.host}:${cfg.server.port}`;
}

export function getApiUrl(cfg: BackendConfig = defaultConfig): string {
  const base = getServerUrl(cfg);
  return cfg.api.versioned
    ? `${base}${cfg.api.basePath}/v1`
    : `${base}${cfg.api.basePath}`;
}

export function getHealthCheck(version = '1.0.0'): HealthCheckResponse {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version,
  };
}

export function getHealthCheckUrl(cfg: BackendConfig = defaultConfig): string {
  return `${getApiUrl(cfg)}/health`;
}

export function createConfigFromEnv(env: Record<string, string | undefined>): BackendConfig {
  const parsedPort = env['PORT'] ? parseInt(env['PORT'], 10) : NaN;
  const isValidPort = Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535;
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

export function buildRoute(cfg: BackendConfig, ...segments: string[]): string {
  const apiUrl = getApiUrl(cfg);
  const joined = segments
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return joined ? `${apiUrl}/${joined}` : apiUrl;
}

/** Validates a backend configuration and returns an array of error messages (empty if valid). */
export function validateConfig(cfg: BackendConfig): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(cfg.server.port) || cfg.server.port < 1 || cfg.server.port > 65535) {
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

export interface RouteNamespace {
  prefix: string;
  routes: string[];
}

export interface RequestContext {
  requestId: string;
  timestamp: string;
  path: string;
  method: string;
}

const defaultCorsConfig: CorsConfig = {
  allowedOrigins: ['*'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};

const defaultRateLimitConfig: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 100,
};

export function getCorsConfig(cfg: BackendConfig): CorsConfig {
  return cfg.cors ?? defaultCorsConfig;
}

export function getRateLimitConfig(cfg: BackendConfig): RateLimitConfig {
  return cfg.rateLimit ?? defaultRateLimitConfig;
}

export function createRouteNamespace(
  cfg: BackendConfig,
  prefix: string,
  routes: string[]
): RouteNamespace {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const cleanRoutes = routes.map((r) => {
    const cleaned = r.replace(/^\/+|\/+$/g, '');
    return `${buildRoute(cfg, cleanPrefix, cleaned)}`;
  });
  return { prefix: cleanPrefix, routes: cleanRoutes };
}

export function createRequestContext(
  path: string,
  method: string
): RequestContext {
  return {
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    path,
    method: method.toUpperCase(),
  };
}

function generateRequestId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'req_';
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/** Shallow-merges a partial override into a base backend configuration. */
export function mergeConfig(
  base: BackendConfig,
  overrides: Partial<BackendConfig>
): BackendConfig {
  const merged: BackendConfig = {
    server: { ...base.server, ...overrides.server },
    api: { ...base.api, ...overrides.api },
  };
  const cors = overrides.cors ?? base.cors;
  if (cors !== undefined) {
    merged.cors = cors;
  }
  const rateLimit = overrides.rateLimit ?? base.rateLimit;
  if (rateLimit !== undefined) {
    merged.rateLimit = rateLimit;
  }
  return merged;
}

export { defaultConfig as backendConfig };
