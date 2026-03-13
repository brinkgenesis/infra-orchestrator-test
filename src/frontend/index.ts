import config from '../../frontend.config';
import type { FrontendConfig, DevProxyTarget, DevConfig, BuildConfig, AssetsConfig } from '../../frontend.config';

export type { FrontendConfig, DevProxyTarget, DevConfig, BuildConfig, AssetsConfig };

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
    assets: Partial<FrontendConfig['assets']>;
  }> = {},
): FrontendConfig {
  return {
    dev: { ...config.dev, ...overrides.dev },
    build: { ...config.build, ...overrides.build },
    assets: { ...config.assets, ...overrides.assets },
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
  return cfg.build.minify;
}

export function createPreviewConfig(
  cfg: FrontendConfig = config,
  options: { host?: string; port?: number; strictPort?: boolean } = {},
): Record<string, unknown> {
  const { host = 'localhost', port = cfg.dev.port + 1, strictPort = false } = options;
  return {
    preview: {
      host,
      port,
      strictPort,
    },
    build: {
      outDir: cfg.build.outDir,
      sourcemap: cfg.build.sourcemap,
      minify: cfg.build.minify,
      target: cfg.build.target,
    },
  };
}

export function getBuildTarget(cfg: FrontendConfig = config): string {
  return cfg.build.target;
}

export function getPublicDir(cfg: FrontendConfig = config): string {
  return cfg.assets.publicDir;
}

export function getAssetExtensions(cfg: FrontendConfig = config): readonly string[] {
  return cfg.assets.extensions;
}

export function getProxyConfig(cfg: FrontendConfig = config): Record<string, DevProxyTarget> {
  return cfg.dev.proxy;
}

export function shouldOpenBrowser(cfg: FrontendConfig = config): boolean {
  return cfg.dev.open;
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

  return {
    root,
    base,
    mode,
    server: {
      port: cfg.dev.port,
      open: cfg.dev.open,
      hmr: cfg.dev.hmr,
      proxy: Object.fromEntries(
        Object.entries(cfg.dev.proxy).map(([path, proxyTarget]) => {
          const entry: Record<string, unknown> = {
            target: proxyTarget.target,
            changeOrigin: proxyTarget.changeOrigin ?? true,
          };
          if (proxyTarget.rewrite) entry['rewrite'] = proxyTarget.rewrite;
          return [path, entry];
        }),
      ),
    },
    build: {
      outDir: cfg.build.outDir,
      sourcemap: cfg.build.sourcemap,
      minify: isDev ? false : cfg.build.minify,
      target: cfg.build.target,
    },
    publicDir: cfg.assets.publicDir,
  };
}

export { config as frontendConfig };
