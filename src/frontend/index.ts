import config, { createFrontendConfig } from '../../frontend.config';
import type { FrontendConfig, DevConfig, BuildConfig } from '../../frontend.config';

export type { FrontendConfig, DevConfig, BuildConfig };

export function getDevServerUrl(cfg: FrontendConfig = config): string {
  return `http://localhost:${cfg.dev.port}`;
}

export function resolveFrontendConfig(overrides?: {
  dev?: Partial<FrontendConfig['dev']>;
  build?: Partial<FrontendConfig['build']>;
}): FrontendConfig {
  if (!overrides) return config;
  return createFrontendConfig(overrides);
}

export function isHmrEnabled(cfg: FrontendConfig = config): boolean {
  return cfg.dev.hmr;
}

export function getProxyEntries(cfg: FrontendConfig = config): [string, string][] {
  return Object.entries(cfg.dev.proxy);
}

export function getBuildTarget(cfg: FrontendConfig = config): string {
  return cfg.build.target;
}

export function hasSourcemaps(cfg: FrontendConfig = config): boolean {
  return cfg.build.sourcemap;
}

export { config as frontendConfig, createFrontendConfig };
