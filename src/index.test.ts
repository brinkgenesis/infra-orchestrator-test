import { describe, it, expect } from 'vitest';
import { defaultConfig, resolveConfig, getServerUrl } from './index';

describe('AppConfig', () => {
  it('has correct default values', () => {
    expect(defaultConfig.port).toBe(3000);
    expect(defaultConfig.host).toBe('localhost');
    expect(defaultConfig.env).toBe('development');
  });

  it('resolveConfig returns defaults when no overrides given', () => {
    expect(resolveConfig()).toEqual(defaultConfig);
  });

  it('resolveConfig merges overrides', () => {
    const config = resolveConfig({ port: 8080, env: 'production' });
    expect(config.port).toBe(8080);
    expect(config.host).toBe('localhost');
    expect(config.env).toBe('production');
  });

  it('getServerUrl returns correct URL', () => {
    expect(getServerUrl()).toBe('http://localhost:3000');
    expect(getServerUrl({ port: 8080, host: '0.0.0.0', env: 'production' }))
      .toBe('http://0.0.0.0:8080');
  });
});
