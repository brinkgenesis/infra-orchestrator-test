export interface BackendConfig {
  server: {
    port: number;
    host: string;
  };
  api: {
    basePath: string;
    versioned: boolean;
  };
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
  return {
    server: {
      port: Number.isFinite(parsedPort) ? parsedPort : defaultConfig.server.port,
      host: env['HOST'] ?? defaultConfig.server.host,
    },
    api: {
      basePath: env['API_BASE_PATH'] ?? defaultConfig.api.basePath,
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

export function validateConfig(cfg: BackendConfig): string[] {
  const errors: string[] = [];
  if (cfg.server.port < 1 || cfg.server.port > 65535) {
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

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function createRateLimiter(config: RateLimitConfig) {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return function checkRate(clientId: string, now = Date.now()): RateLimitResult {
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
  };
}

export function formatRoute(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

export function isHealthy(health: HealthCheckResponse): boolean {
  return health.status === 'ok';
}

export { defaultConfig as backendConfig };
