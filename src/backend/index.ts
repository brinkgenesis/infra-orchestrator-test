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

export function getServerUrl(cfg: BackendConfig = defaultConfig): string {
  return `http://${cfg.server.host}:${cfg.server.port}`;
}

export function getApiUrl(cfg: BackendConfig = defaultConfig): string {
  const base = getServerUrl(cfg);
  return cfg.api.versioned
    ? `${base}${cfg.api.basePath}/v1`
    : `${base}${cfg.api.basePath}`;
}

export { defaultConfig as backendConfig };
