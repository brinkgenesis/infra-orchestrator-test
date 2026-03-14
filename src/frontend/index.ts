import config, { createFrontendConfig } from '../../frontend.config';
import type { FrontendConfig, DevProxyTarget, DevConfig, BuildConfig, AssetsConfig } from '../../frontend.config';

export type { FrontendConfig, DevProxyTarget, DevConfig, BuildConfig, AssetsConfig };

export { createFrontendConfig };

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
    preview: { host, port, strictPort },
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

export function getDevProxyPaths(cfg: FrontendConfig = config): string[] {
  return Object.keys(cfg.dev.proxy);
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

export function getAssetsConfig(cfg: FrontendConfig = config): AssetsConfig {
  return cfg.assets ?? { publicDir: 'public', extensions: ['png', 'jpg', 'svg', 'ico'] };
}

export function resolveAssetPublicPath(fileName: string, cfg: FrontendConfig = config): string {
  const assets = getAssetsConfig(cfg);
  const dir = assets.publicDir.replace(/\/+$/, '');
  const clean = fileName.replace(/^\/+/, '');
  return `${dir}/${clean}`;
}

export function isAllowedAsset(fileName: string, cfg: FrontendConfig = config): boolean {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1) return false;
  const ext = fileName.slice(dot + 1).toLowerCase();
  const allowed = getAssetExtensions(cfg);
  return allowed.some((e) => e.toLowerCase() === ext);
}

export type PresetName = 'development' | 'staging' | 'production';

const defaultAssets: AssetsConfig = { publicDir: 'public', extensions: ['png', 'jpg', 'svg', 'ico'] };

const presets: Record<PresetName, FrontendConfig> = {
  development: {
    dev: { port: 3000, hmr: true, open: true, proxy: {} },
    build: { outDir: 'dist', sourcemap: true, minify: false, target: 'ES2022' },
    assets: defaultAssets,
  },
  staging: {
    dev: { port: 3000, hmr: false, open: false, proxy: {} },
    build: { outDir: 'dist', sourcemap: true, minify: true, target: 'ES2022' },
    assets: defaultAssets,
  },
  production: {
    dev: { port: 3000, hmr: false, open: false, proxy: {} },
    build: { outDir: 'dist', sourcemap: false, minify: true, target: 'ES2022' },
    assets: defaultAssets,
  },
};

export function getPreset(name: PresetName): FrontendConfig {
  const p = presets[name];
  return { dev: { ...p.dev }, build: { ...p.build }, assets: { ...p.assets } };
}

export function getPresetWith(
  name: PresetName,
  overrides: Partial<{ dev: Partial<DevConfig>; build: Partial<BuildConfig> }>,
): FrontendConfig {
  const base = getPreset(name);
  return {
    dev: { ...base.dev, ...overrides.dev },
    build: { ...base.build, ...overrides.build },
    assets: { ...base.assets },
  };
}

export function configsEqual(a: FrontendConfig, b: FrontendConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function serializeConfig(cfg: FrontendConfig): string {
  return JSON.stringify({ dev: cfg.dev, build: cfg.build, assets: cfg.assets }, null, 2);
}

export function deserializeConfig(json: string): FrontendConfig {
  const parsed = JSON.parse(json) as { dev: DevConfig; build: BuildConfig; assets: AssetsConfig };
  return { dev: parsed.dev, build: parsed.build, assets: parsed.assets };
}

export { config as frontendConfig };
