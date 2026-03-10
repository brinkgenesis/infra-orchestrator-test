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

export function isMinifyEnabled(cfg: FrontendConfig = config): boolean {
  return cfg.build.minify ?? false;
}

export function getBuildTarget(cfg: FrontendConfig = config): string {
  return cfg.build.target ?? 'es2022';
}

export function getPublicDir(cfg: FrontendConfig = config): string {
  return cfg.assets?.publicDir ?? 'public';
}

export function getAssetExtensions(cfg: FrontendConfig = config): readonly string[] {
  return cfg.assets?.extensions ?? [];
}

export function getProxyConfig(cfg: FrontendConfig = config): Record<string, DevProxyTarget> {
  return cfg.dev.proxy ?? {};
}

export function shouldOpenBrowser(cfg: FrontendConfig = config): boolean {
  return cfg.dev.open ?? false;
}

export interface ViteConfigOptions {
  root?: string;
  base?: string;
  mode?: 'development' | 'production';
}

export function buildViteConfig(
  cfg: FrontendConfig = config,
  options: ViteConfigOptions = {},
): Record<string, unknown> {
  const { root = '.', base = '/', mode = 'development' } = options;
  const isDev = mode === 'development';
  const proxy = cfg.dev.proxy ?? {};

  return {
    root,
    base,
    mode,
    server: {
      port: cfg.dev.port,
      open: cfg.dev.open ?? false,
      hmr: cfg.dev.hmr,
      proxy: Object.fromEntries(
        Object.entries(proxy).map(([path, proxyTarget]) => [
          path,
          { target: proxyTarget.target, changeOrigin: proxyTarget.changeOrigin ?? true },
        ]),
      ),
    },
    build: {
      outDir: cfg.build.outDir,
      sourcemap: cfg.build.sourcemap,
      minify: isDev ? false : (cfg.build.minify ?? false),
      target: cfg.build.target ?? 'es2022',
    },
    publicDir: cfg.assets?.publicDir ?? 'public',
  };
}

export { config as frontendConfig };
