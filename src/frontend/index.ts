import config from '../../frontend.config';
import type { FrontendConfig } from '../../frontend.config';

export type { FrontendConfig };

export function getDevServerUrl(cfg: FrontendConfig = config): string {
  return `http://localhost:${cfg.dev.port}`;
}

export function getBuildOutDir(cfg: FrontendConfig = config): string {
  return cfg.build.outDir;
}

export function isSourcemapEnabled(cfg: FrontendConfig = config): boolean {
  return cfg.build.sourcemap;
}

export function isHmrEnabled(cfg: FrontendConfig = config): boolean {
  return cfg.dev.hmr;
}

export function createFrontendConfig(
  overrides: Partial<{ dev: Partial<FrontendConfig['dev']>; build: Partial<FrontendConfig['build']> }> = {},
): FrontendConfig {
  return {
    dev: { ...config.dev, ...overrides.dev },
    build: { ...config.build, ...overrides.build },
  };
}

export { config as frontendConfig };
