export interface AppConfig {
  port: number;
  host: string;
  env: 'development' | 'production' | 'test';
}

export const defaultConfig: AppConfig = {
  port: 3000,
  host: 'localhost',
  env: 'development',
};

/** Merges the provided overrides with the default application config and returns the result. */
export function resolveConfig(overrides?: Partial<AppConfig>): AppConfig {
  return { ...defaultConfig, ...overrides };
}

/** Returns the full server URL string derived from the given config. */
export function getServerUrl(config: AppConfig = defaultConfig): string {
  return `http://${config.host}:${config.port}`;
}
