import config from '../../frontend.config';
import type { FrontendConfig, DevProxyTarget } from '../../frontend.config';

export type { FrontendConfig, DevProxyTarget };

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
  overrides: Partial<{
    dev: Partial<FrontendConfig['dev']>;
    build: Partial<FrontendConfig['build']>;
    assets: Partial<NonNullable<FrontendConfig['assets']>>;
  }> = {},
): FrontendConfig {
  return {
    dev: { ...config.dev, ...overrides.dev },
    build: { ...config.build, ...overrides.build },
    ...(config.assets ?? overrides.assets
      ? { assets: { ...config.assets, ...overrides.assets } as NonNullable<FrontendConfig['assets']> }
      : {}),
  };
}

export function getPublicUrl(path: string = '/', cfg: FrontendConfig = config): string {
  const base = `http://localhost:${cfg.dev.port}`;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function getAssetPublicPath(cfg: FrontendConfig = config): string {
  return `/${cfg.build.outDir}/`;
}

export function resolveAssetUrl(assetName: string, cfg: FrontendConfig = config): string {
  const base = getAssetPublicPath(cfg);
  const cleaned = assetName.replace(/^\/+/, '');
  return `${base}${cleaned}`;
}

export function isDevMode(cfg: FrontendConfig = config): boolean {
  return cfg.dev.hmr && cfg.dev.port > 0;
}

export { config as frontendConfig };
