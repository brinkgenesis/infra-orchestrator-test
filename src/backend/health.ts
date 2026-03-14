import type { AppConfig } from '../index';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  version: string;
}

const startTime = Date.now();

/** Returns the current health status of the application including uptime and version info. */
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

/** Maps a health status value to the corresponding HTTP status code. */
export function mapHealthStatusToHttpCode(status: HealthStatus['status']): number {
  switch (status) {
    case 'healthy':
      return 200;
    case 'degraded':
      return 207;
    case 'unhealthy':
      return 503;
  }
}
