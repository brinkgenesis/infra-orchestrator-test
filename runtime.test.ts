import { describe, it, expect } from 'vitest';
import { defaultConfig } from './src/index';
import type { AppConfig } from './src/index';

describe('runtime reliability', () => {
  it('defaultConfig has valid port', () => {
    expect(defaultConfig.port).toBeGreaterThan(0);
    expect(defaultConfig.port).toBeLessThanOrEqual(65535);
  });

  it('defaultConfig has valid host', () => {
    expect(typeof defaultConfig.host).toBe('string');
    expect(defaultConfig.host.length).toBeGreaterThan(0);
  });

  it('defaultConfig env is a known value', () => {
    const validEnvs = ['development', 'production', 'test'] as const;
    expect(validEnvs).toContain(defaultConfig.env);
  });

  it('AppConfig type is structurally sound', () => {
    const testConfig: AppConfig = {
      port: 8080,
      host: '0.0.0.0',
      env: 'production',
    };
    expect(testConfig).toBeDefined();
    expect(testConfig.port).toBe(8080);
  });
});
