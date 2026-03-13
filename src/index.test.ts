import { describe, it, expect } from 'vitest';
import { defaultConfig, resolveConfig, getServerUrl } from './index';
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

describe('resolveConfig', () => {
  it('returns defaults when called with no overrides', () => {
    const cfg = resolveConfig();
    expect(cfg).toEqual(defaultConfig);
  });

  it('merges partial overrides onto defaults', () => {
    const cfg = resolveConfig({ port: 8080 });
    expect(cfg.port).toBe(8080);
    expect(cfg.host).toBe('localhost');
    expect(cfg.env).toBe('development');
  });

  it('allows overriding all fields', () => {
    const cfg = resolveConfig({ port: 9000, host: '0.0.0.0', env: 'production' });
    expect(cfg.port).toBe(9000);
    expect(cfg.host).toBe('0.0.0.0');
    expect(cfg.env).toBe('production');
  });
});

describe('getServerUrl', () => {
  it('returns correct URL from default config', () => {
    expect(getServerUrl()).toBe('http://localhost:3000');
  });

  it('returns correct URL from custom config', () => {
    expect(getServerUrl({ port: 8080, host: '0.0.0.0', env: 'production' })).toBe('http://0.0.0.0:8080');
  });
});
