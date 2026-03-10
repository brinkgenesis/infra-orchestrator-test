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

export function getDevServerConfig(cfg: FrontendConfig = config): {
  url: string;
  port: number;
  hmr: boolean;
} {
  return {
    url: `http://localhost:${cfg.dev.port}`,
    port: cfg.dev.port,
    hmr: cfg.dev.hmr,
  };
}

export function validateFrontendConfig(cfg: FrontendConfig): string[] {
  const errors: string[] = [];
  if (cfg.dev.port < 1 || cfg.dev.port > 65535) {
    errors.push(`Invalid port: ${cfg.dev.port}. Must be between 1 and 65535.`);
  }
  if (!cfg.build.outDir || cfg.build.outDir.trim() === '') {
    errors.push('Build output directory must not be empty.');
  }
  return errors;
}

export { config as frontendConfig };
