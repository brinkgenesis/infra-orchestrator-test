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

export function getBuildConfig(cfg: FrontendConfig = config): {
  outDir: string;
  sourcemap: boolean;
} {
  return {
    outDir: cfg.build.outDir,
    sourcemap: cfg.build.sourcemap,
  };
}

export function validateFrontendConfig(cfg: FrontendConfig): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(cfg.dev.port) || cfg.dev.port < 1 || cfg.dev.port > 65535) {
    errors.push(`Invalid port: ${cfg.dev.port}. Must be between 1 and 65535.`);
  }
  if (!cfg.build.outDir || cfg.build.outDir.trim() === '') {
    errors.push('Build output directory must not be empty.');
  }
  return errors;
}

export function resolveOutPath(
  filePath: string,
  cfg: FrontendConfig = config,
): string {
  const outDir = cfg.build.outDir.replace(/\/+$/, '');
  const clean = filePath.replace(/^\/+/, '');
  return `${outDir}/${clean}`;
}

export function formatDevBanner(cfg: FrontendConfig = config): string {
  const hmrStatus = cfg.dev.hmr ? 'enabled' : 'disabled';
  return `Dev server: http://localhost:${cfg.dev.port} | HMR: ${hmrStatus}`;
}

export function getConfigSnapshot(cfg: FrontendConfig = config): string {
  return JSON.stringify({ dev: cfg.dev, build: cfg.build });
}

export interface DevProxyConfig {
  target: string;
  pathRewrite: Record<string, string>;
  changeOrigin: boolean;
}

export function createDevProxyConfig(
  backendUrl: string,
  rewrites: Record<string, string> = { '/api': '/api' },
): DevProxyConfig {
  return {
    target: backendUrl,
    pathRewrite: rewrites,
    changeOrigin: true,
  };
}

export function createConfigFromEnv(env: Record<string, string | undefined>): FrontendConfig {
  const parsedPort = env['DEV_PORT'] ? parseInt(env['DEV_PORT'], 10) : NaN;
  return {
    dev: {
      port: Number.isFinite(parsedPort) ? parsedPort : config.dev.port,
      hmr: env['HMR'] !== 'false',
    },
    build: {
      outDir: env['OUT_DIR'] ?? config.build.outDir,
      sourcemap: env['SOURCEMAP'] !== 'false',
    },
  };
}

export function mergeConfigs(
  base: FrontendConfig,
  overrides: Partial<{ dev: Partial<FrontendConfig['dev']>; build: Partial<FrontendConfig['build']> }>,
): FrontendConfig {
  return {
    dev: { ...base.dev, ...overrides.dev },
    build: { ...base.build, ...overrides.build },
  };
}

export function getAssetPath(filePath: string, hash: string, cfg: FrontendConfig = config): string {
  const outDir = cfg.build.outDir.replace(/\/+$/, '');
  const ext = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')) : '';
  const name = filePath.includes('.') ? filePath.slice(0, filePath.lastIndexOf('.')) : filePath;
  const clean = name.replace(/^\/+/, '');
  return `${outDir}/${clean}.${hash}${ext}`;
}

export function getPublicUrl(basePath: string, cfg: FrontendConfig = config): string {
  const base = basePath.replace(/\/+$/, '');
  return `${base}/${cfg.build.outDir}`;
}

export function validateDevProxyConfig(proxy: DevProxyConfig): string[] {
  const errors: string[] = [];
  if (!proxy.target || proxy.target.trim() === '') {
    errors.push('Proxy target must not be empty.');
  }
  try {
    if (proxy.target) new URL(proxy.target);
  } catch {
    errors.push(`Invalid proxy target URL: ${proxy.target}`);
  }
  if (Object.keys(proxy.pathRewrite).length === 0) {
    errors.push('Proxy must have at least one path rewrite rule.');
  }
  return errors;
}

export function isDevMode(env: Record<string, string | undefined> = {}): boolean {
  return env['NODE_ENV'] !== 'production';
}

export type AssetManifestEntry = {
  src: string;
  file: string;
  isEntry?: boolean;
};

export type AssetManifest = Record<string, AssetManifestEntry>;

export function buildAssetManifest(
  entries: Array<{ src: string; hash: string; isEntry?: boolean }>,
  cfg: FrontendConfig = config,
): AssetManifest {
  const manifest: AssetManifest = {};
  for (const entry of entries) {
    const file = getAssetPath(entry.src, entry.hash, cfg);
    const item: AssetManifestEntry = { src: entry.src, file };
    if (entry.isEntry !== undefined) item.isEntry = entry.isEntry;
    manifest[entry.src] = item;
  }
  return manifest;
}

export function formatBuildSummary(
  manifest: AssetManifest,
  cfg: FrontendConfig = config,
): string {
  const count = Object.keys(manifest).length;
  const entryCount = Object.values(manifest).filter((e) => e.isEntry).length;
  const smLabel = cfg.build.sourcemap ? 'on' : 'off';
  return `Build: ${count} asset(s), ${entryCount} entry point(s), sourcemaps ${smLabel} -> ${cfg.build.outDir}`;
}

export { config as frontendConfig };
