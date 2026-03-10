import { AppConfig, defaultConfig } from '../index';

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

export function createServerStatus(): ServerStatus {
  return {
    running: false,
    uptime: 0,
    requestCount: 0,
  };
}

export function getServerAddress(config: AppConfig = defaultConfig): string {
  return `http://${config.host}:${config.port}`;
}

export function isProduction(config: AppConfig = defaultConfig): boolean {
  return config.env === 'production';
}
