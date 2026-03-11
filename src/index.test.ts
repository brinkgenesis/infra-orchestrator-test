import { describe, it, expect } from 'vitest';
import { defaultConfig } from './index';
import type { AppConfig } from './index';

describe('AppConfig', () => {
  it('should have valid default config values', () => {
    expect(defaultConfig.port).toBe(3000);
    expect(defaultConfig.host).toBe('localhost');
    expect(defaultConfig.env).toBe('development');
  });

  it('should allow all valid environment values', () => {
    const envs: AppConfig['env'][] = ['development', 'production', 'test'];
    for (const env of envs) {
      const config: AppConfig = { ...defaultConfig, env };
      expect(config.env).toBe(env);
    }
  });
});
