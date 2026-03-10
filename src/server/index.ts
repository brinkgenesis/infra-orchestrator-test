import { AppConfig, defaultConfig } from '../index';

export interface ServerContext {
  config: AppConfig;
  startedAt: number;
}

export function createServerContext(config: AppConfig = defaultConfig): ServerContext {
  return {
    config,
    startedAt: Date.now(),
  };
}

export function getServerAddress(ctx: ServerContext): string {
  return `http://${ctx.config.host}:${ctx.config.port}`;
}

export function getUptime(ctx: ServerContext): number {
  return Date.now() - ctx.startedAt;
}
