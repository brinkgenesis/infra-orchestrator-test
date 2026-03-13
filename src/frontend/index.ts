import config, { createFrontendConfig } from '../../frontend.config';
import type { FrontendConfig, DevConfig, BuildConfig, DeepPartial } from '../../frontend.config';

export type { FrontendConfig, DevConfig, BuildConfig, DeepPartial };

/** Returns the dev server URL (http://localhost:{port}) from the given frontend config. */
export function getDevServerUrl(cfg: FrontendConfig = config): string {
  return `http://localhost:${cfg.dev.port}`;
}

/** Returns the build output directory path from the given frontend config. */
export function getBuildOutDir(cfg: FrontendConfig = config): string {
  return cfg.build.outDir;
}

/** Returns true if source maps are enabled in the given frontend config. */
export function isSourcemapEnabled(cfg: FrontendConfig = config): boolean {
  return cfg.build.sourcemap;
}

/** Returns true if Hot Module Replacement is enabled in the given frontend config. */
export function isHmrEnabled(cfg: FrontendConfig = config): boolean {
  return cfg.dev.hmr;
}

/** Returns the resolved frontend config, applying any provided dev/build overrides. */
export function resolveFrontendConfig(overrides?: {
  dev?: Partial<FrontendConfig['dev']>;
  build?: Partial<FrontendConfig['build']>;
}): FrontendConfig {
  if (!overrides) return config;
  return createFrontendConfig(overrides);
}

/** Returns a dev server descriptor object containing the URL, port, and HMR flag. */
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

/** Returns an object with the build output directory and sourcemap flag. */
export function getBuildConfig(cfg: FrontendConfig = config): {
  outDir: string;
  sourcemap: boolean;
} {
  return {
    outDir: cfg.build.outDir,
    sourcemap: cfg.build.sourcemap,
  };
}

/** Validates the frontend config and returns an array of human-readable error messages. */
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

/** Resolves a file path relative to the build output directory specified in the config. */
export function resolveOutPath(
  filePath: string,
  cfg: FrontendConfig = config,
): string {
  const outDir = cfg.build.outDir.replace(/\/+$/, '');
  const clean = filePath.replace(/^\/+/, '');
  return `${outDir}/${clean}`;
}

/** Returns a formatted banner string showing the dev server URL and HMR status. */
export function formatDevBanner(cfg: FrontendConfig = config): string {
  const hmrStatus = cfg.dev.hmr ? 'enabled' : 'disabled';
  return `Dev server: http://localhost:${cfg.dev.port} | HMR: ${hmrStatus}`;
}

/** Returns a JSON snapshot string of the dev and build sections of the frontend config. */
export function getConfigSnapshot(cfg: FrontendConfig = config): string {
  return JSON.stringify({ dev: cfg.dev, build: cfg.build });
}

export interface DevProxyConfig {
  target: string;
  pathRewrite: Record<string, string>;
  changeOrigin: boolean;
}

/** Creates a dev proxy config pointing at the given backend URL with the specified path rewrites. */
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

/** Builds a FrontendConfig from environment variables (DEV_PORT, HMR, OUT_DIR, SOURCEMAP). */
export function createConfigFromEnv(env: Record<string, string | undefined>): FrontendConfig {
  const parsedPort = env['DEV_PORT'] ? parseInt(env['DEV_PORT'], 10) : NaN;
  return {
    dev: {
      port: Number.isFinite(parsedPort) ? parsedPort : config.dev.port,
      hmr: env['HMR'] !== 'false',
      open: config.dev.open,
      proxy: { ...config.dev.proxy },
    },
    build: {
      outDir: env['OUT_DIR'] ?? config.build.outDir,
      sourcemap: env['SOURCEMAP'] !== 'false',
      minify: config.build.minify,
      target: config.build.target,
    },
  };
}

/** Merges dev and build overrides onto a base FrontendConfig and returns the result. */
export function mergeConfigs(
  base: FrontendConfig,
  overrides: Partial<{ dev: Partial<FrontendConfig['dev']>; build: Partial<FrontendConfig['build']> }>,
): FrontendConfig {
  return {
    dev: { ...base.dev, ...overrides.dev },
    build: { ...base.build, ...overrides.build },
  };
}

/** Returns the content-hashed output path for a source file under the build output directory. */
export function getAssetPath(filePath: string, hash: string, cfg: FrontendConfig = config): string {
  const outDir = cfg.build.outDir.replace(/\/+$/, '');
  const ext = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')) : '';
  const name = filePath.includes('.') ? filePath.slice(0, filePath.lastIndexOf('.')) : filePath;
  const clean = name.replace(/^\/+/, '');
  return `${outDir}/${clean}.${hash}${ext}`;
}

/** Returns the public URL for the build output directory under the given base path. */
export function getPublicUrl(basePath: string, cfg: FrontendConfig = config): string {
  const base = basePath.replace(/\/+$/, '');
  return `${base}/${cfg.build.outDir}`;
}

/** Validates a dev proxy config and returns an array of human-readable error messages. */
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

/** Returns true if NODE_ENV is not "production" in the given environment map. */
export function isDevMode(env: Record<string, string | undefined> = {}): boolean {
  return env['NODE_ENV'] !== 'production';
}

export type AssetManifestEntry = {
  src: string;
  file: string;
  isEntry?: boolean;
};

export type AssetManifest = Record<string, AssetManifestEntry>;

/** Builds an asset manifest mapping source paths to their hashed output paths. */
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

/** Formats a human-readable build summary string from the asset manifest and config. */
export function formatBuildSummary(
  manifest: AssetManifest,
  cfg: FrontendConfig = config,
): string {
  const count = Object.keys(manifest).length;
  const entryCount = Object.values(manifest).filter((e) => e.isEntry).length;
  const smLabel = cfg.build.sourcemap ? 'on' : 'off';
  return `Build: ${count} asset(s), ${entryCount} entry point(s), sourcemaps ${smLabel} -> ${cfg.build.outDir}`;
}

/** Returns the dev proxy entries as an array of [from, to] tuples. */
export function getProxyEntries(cfg: FrontendConfig = config): [string, string][] {
  return Object.entries(cfg.dev.proxy);
}

/** Returns the build target string (e.g. "es2020") from the frontend config. */
export function getBuildTarget(cfg: FrontendConfig = config): string {
  return cfg.build.target;
}

/** Returns true if source maps are enabled in the build config. */
export function hasSourcemaps(cfg: FrontendConfig = config): boolean {
  return cfg.build.sourcemap;
}

/** Returns true if the dev server should automatically open a browser on start. */
export function shouldOpenBrowser(cfg: FrontendConfig = config): boolean {
  return cfg.dev.open;
}

/** Returns true if minification is enabled in the build config. */
export function isMinifyEnabled(cfg: FrontendConfig = config): boolean {
  return cfg.build.minify;
}

/** Returns the dev proxy entries as an array of {from, to} objects. */
export function getDevProxyEntries(cfg: FrontendConfig = config): Array<{ from: string; to: string }> {
  return Object.entries(cfg.dev.proxy).map(([from, to]) => ({ from, to }));
}

/** Returns the fully-qualified public URL for a hashed asset under the given base path. */
export function resolveAssetUrl(
  basePath: string,
  filePath: string,
  hash: string,
  cfg: FrontendConfig = config,
): string {
  const base = basePath.replace(/\/+$/, '');
  const assetPath = getAssetPath(filePath, hash, cfg);
  return `${base}/${assetPath}`;
}

/** Returns an array of human-readable diff strings describing the differences between two frontend configs. */
export function diffConfigs(
  a: FrontendConfig,
  b: FrontendConfig,
): string[] {
  const diffs: string[] = [];
  if (a.dev.port !== b.dev.port) diffs.push(`dev.port: ${a.dev.port} -> ${b.dev.port}`);
  if (a.dev.hmr !== b.dev.hmr) diffs.push(`dev.hmr: ${a.dev.hmr} -> ${b.dev.hmr}`);
  if (a.dev.open !== b.dev.open) diffs.push(`dev.open: ${a.dev.open} -> ${b.dev.open}`);
  const sortedProxy = (p: Record<string, unknown>) =>
    JSON.stringify(Object.fromEntries(Object.keys(p).sort().map((k) => [k, p[k]])));
  const proxyA = sortedProxy(a.dev.proxy as Record<string, unknown>);
  const proxyB = sortedProxy(b.dev.proxy as Record<string, unknown>);
  if (proxyA !== proxyB) diffs.push(`dev.proxy: ${proxyA} -> ${proxyB}`);
  if (a.build.outDir !== b.build.outDir) diffs.push(`build.outDir: ${a.build.outDir} -> ${b.build.outDir}`);
  if (a.build.sourcemap !== b.build.sourcemap) diffs.push(`build.sourcemap: ${a.build.sourcemap} -> ${b.build.sourcemap}`);
  if (a.build.minify !== b.build.minify) diffs.push(`build.minify: ${a.build.minify} -> ${b.build.minify}`);
  if (a.build.target !== b.build.target) diffs.push(`build.target: ${a.build.target} -> ${b.build.target}`);
  return diffs;
}

/** Returns a complete dev environment descriptor combining server config, banner, proxy entries, and validation errors. */
export function createDevEnvironment(cfg: FrontendConfig = config): {
  server: { url: string; port: number; hmr: boolean };
  banner: string;
  proxy: Array<{ from: string; to: string }>;
  errors: string[];
} {
  return {
    server: getDevServerConfig(cfg),
    banner: formatDevBanner(cfg),
    proxy: getDevProxyEntries(cfg),
    errors: validateFrontendConfig(cfg),
  };
}

/** Returns a complete build environment descriptor combining build config, target, asset manifest, and summary. */
export function createBuildEnvironment(
  entries: Array<{ src: string; hash: string; isEntry?: boolean }>,
  cfg: FrontendConfig = config,
): {
  config: { outDir: string; sourcemap: boolean };
  target: string;
  manifest: AssetManifest;
  summary: string;
} {
  const manifest = buildAssetManifest(entries, cfg);
  return {
    config: getBuildConfig(cfg),
    target: getBuildTarget(cfg),
    manifest,
    summary: formatBuildSummary(manifest, cfg),
  };
}

export { config as frontendConfig, createFrontendConfig };
