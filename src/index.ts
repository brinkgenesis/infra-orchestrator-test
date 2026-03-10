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

export function resolveConfig(overrides?: Partial<AppConfig>): AppConfig {
  return { ...defaultConfig, ...overrides };
}

export function getServerUrl(config: AppConfig = defaultConfig): string {
  return `http://${config.host}:${config.port}`;
}
