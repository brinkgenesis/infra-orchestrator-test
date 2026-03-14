export interface DevProxyTarget {
  target: string;
  changeOrigin?: boolean;
  rewrite?: (path: string) => string;
}

export interface DevConfig {
  port: number;
  hmr: boolean;
  proxy: Record<string, DevProxyTarget>;
  open: boolean;
}

export interface BuildConfig {
  outDir: string;
  sourcemap: boolean;
  minify: boolean;
  target: string;
}

export interface AssetsConfig {
  publicDir: string;
  extensions: readonly string[];
}

export interface FrontendConfig {
  dev: DevConfig;
  build: BuildConfig;
  assets: AssetsConfig;
}

/**
 * Frontend & DX configuration for the infra orchestrator.
 */
const config: FrontendConfig = {
  dev: {
    port: 3000,
    hmr: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: true,
    target: 'es2022',
  },
  assets: {
    publicDir: 'public',
    extensions: ['png', 'jpg', 'svg', 'woff2', 'woff'] as const,
  },
};

<<<<<<< HEAD
export function createFrontendConfig(overrides: Partial<{
  dev: Partial<FrontendConfig['dev']>;
  build: Partial<FrontendConfig['build']>;
  assets: Partial<FrontendConfig['assets']>;
}> = {}): FrontendConfig {
  return {
    dev: { ...config.dev, ...overrides.dev },
    build: { ...config.build, ...overrides.build },
    assets: {
      ...config.assets,
      ...overrides.assets,
      extensions: [...(overrides.assets?.extensions ?? config.assets.extensions)],
    },
=======
export function createFrontendConfig(overrides: DeepPartial<FrontendConfig> = {}): FrontendConfig {
  const cfg: FrontendConfig = {
    dev: { ...defaultDev, ...overrides.dev, proxy: { ...defaultDev.proxy, ...overrides.dev?.proxy } as Record<string, string> },
    build: { ...defaultBuild, ...overrides.build },
>>>>>>> 66093d5 (feat: add assets config support to frontend config and utilities)
  };
  if (overrides.assets) {
    cfg.assets = {
      publicDir: overrides.assets.publicDir ?? 'public',
      extensions: overrides.assets.extensions ?? ['png', 'jpg', 'svg', 'ico'],
    };
  }
  return cfg;
}

export default config;
