import { ServerContext, getUptime } from '../server';

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  uptime: number;
  env: string;
}

export function getHealthStatus(ctx: ServerContext): HealthResponse {
  return {
    status: 'healthy',
    uptime: getUptime(ctx),
    env: ctx.config.env,
  };
}
