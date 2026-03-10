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
        Object.entries(cfg.dev.proxy).map(([path, proxyTarget]) => [
          path,
          { target: proxyTarget.target, changeOrigin: proxyTarget.changeOrigin ?? true },
        ]),
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

export function validateFrontendConfig(cfg: FrontendConfig = config): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(cfg.dev.port) || cfg.dev.port < 1 || cfg.dev.port > 65535) {
    errors.push(`Invalid dev port: ${cfg.dev.port}. Must be an integer between 1 and 65535.`);
  }

  if (cfg.build.outDir.trim() === '') {
    errors.push('Build outDir must not be empty.');
  }

  const validTargets = ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'];
  if (!validTargets.includes(cfg.build.target)) {
    errors.push(`Invalid build target: ${cfg.build.target}. Must be one of: ${validTargets.join(', ')}.`);
  }

  return errors;
}

export { config as frontendConfig };
