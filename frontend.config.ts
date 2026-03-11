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

export interface FrontendConfig {
  dev: DevConfig;
  build: BuildConfig;
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

/**
 * Frontend & DX configuration for the infra orchestrator.
 */
const config: FrontendConfig = {
  dev: defaultDev,
  build: defaultBuild,
};

export function createFrontendConfig(overrides: DeepPartial<FrontendConfig> = {}): FrontendConfig {
  return {
    dev: { ...defaultDev, ...overrides.dev, proxy: { ...defaultDev.proxy, ...overrides.dev?.proxy } as Record<string, string> },
    build: { ...defaultBuild, ...overrides.build },
  };
}

export { defaultDev, defaultBuild };
export default config;
