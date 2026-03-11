import type { AppConfig } from '../index';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  version: string;
}

const startTime = Date.now();

/** Returns the current health status of the application including uptime and version. */
export function getHealthStatus(version = '0.1.0'): HealthStatus {
  return {
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    version,
  };
}

/** Constructs the base HTTP URL from the given application config. */
export function buildBaseUrl(config: AppConfig): string {
  return `http://${config.host}:${config.port}`;
}
