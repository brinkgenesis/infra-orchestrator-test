import type { AppConfig } from '../index';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  version: string;
}

const startTime = Date.now();

export function getHealthStatus(version = '0.1.0'): HealthStatus {
  return {
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    version,
  };
}

export function buildBaseUrl(config: AppConfig): string {
  return `http://${config.host}:${config.port}`;
}
