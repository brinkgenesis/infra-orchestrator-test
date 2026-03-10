import { describe, it, expect } from 'vitest';
import { defaultConfig } from './index';
import type { AppConfig } from './index';

describe('AppConfig', () => {
  it('has correct default values', () => {
    expect(defaultConfig.port).toBe(3000);
    expect(defaultConfig.host).toBe('localhost');
    expect(defaultConfig.env).toBe('development');
  });

  it('satisfies the AppConfig interface', () => {
    const config: AppConfig = defaultConfig;
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('host');
    expect(config).toHaveProperty('env');
  });

  it('has a valid port number', () => {
    expect(defaultConfig.port).toBeGreaterThan(0);
    expect(defaultConfig.port).toBeLessThanOrEqual(65535);
  });

  it('has a valid env value', () => {
    const validEnvs = ['development', 'production', 'test'];
    expect(validEnvs).toContain(defaultConfig.env);
  });
});
