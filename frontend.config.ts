export interface DevProxyTarget {
  target: string;
  changeOrigin?: boolean;
  rewrite?: (path: string) => string;
}

export interface DevConfig {
  port: number;
  hmr: boolean;
  open: boolean;
  proxy: Record<string, string>;
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
  assets?: AssetsConfig;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

const defaultDev: DevConfig = {
  port: 3000,
  hmr: true,
  open: false,
  proxy: {},
};

const defaultBuild: BuildConfig = {
  outDir: 'dist',
  sourcemap: true,
  minify: true,
  target: 'ES2022',
};

const defaultAssets: AssetsConfig = {
  publicDir: 'public',
  extensions: ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico', '.woff', '.woff2'] as const,
};

/**
 * Frontend & DX configuration for the infra orchestrator.
 */
const config: FrontendConfig = {
  dev: defaultDev,
  build: defaultBuild,
};

export function createFrontendConfig(overrides: DeepPartial<FrontendConfig> = {}): FrontendConfig {
  const result: FrontendConfig = {
    dev: { ...defaultDev, ...overrides.dev, proxy: { ...defaultDev.proxy, ...overrides.dev?.proxy } as Record<string, string> },
    build: { ...defaultBuild, ...overrides.build },
  };
  if (overrides.assets) {
    result.assets = {
      ...defaultAssets,
      ...overrides.assets,
      extensions: overrides.assets.extensions ?? defaultAssets.extensions,
    };
  }
  return result;
}

export { defaultDev, defaultBuild, defaultAssets };
export default config;
