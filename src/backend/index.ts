import { type AppConfig, defaultConfig } from '../index';

export interface BackendConfig {
  apiPrefix: string;
  cors: boolean;
  rateLimit: number;
}

export const defaultBackendConfig: BackendConfig = {
  apiPrefix: '/api',
  cors: true,
  rateLimit: 100,
};

export function getServerUrl(config: AppConfig = defaultConfig): string {
  return `http://${config.host}:${config.port}`;
}

export function getHealthEndpoint(config: AppConfig = defaultConfig, backend: BackendConfig = defaultBackendConfig): string {
  return `${getServerUrl(config)}${backend.apiPrefix}/health`;
}
