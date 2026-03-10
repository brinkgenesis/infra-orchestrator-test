import { describe, it, expect } from 'vitest';
import { getServerUrl, getApiUrl, backendConfig } from './index';
import type { BackendConfig } from './index';

describe('backend config', () => {
  it('exports a valid default config object', () => {
    expect(backendConfig).toBeDefined();
    expect(backendConfig.server.port).toBe(8080);
    expect(backendConfig.server.host).toBe('localhost');
    expect(backendConfig.api.basePath).toBe('/api');
    expect(backendConfig.api.versioned).toBe(true);
  });

  it('getServerUrl returns correct URL with default config', () => {
    expect(getServerUrl()).toBe('http://localhost:8080');
  });

  it('getServerUrl respects custom config', () => {
    const custom: BackendConfig = {
      server: { port: 3000, host: '0.0.0.0' },
      api: { basePath: '/api', versioned: false },
    };
    expect(getServerUrl(custom)).toBe('http://0.0.0.0:3000');
  });

  it('getApiUrl returns versioned URL by default', () => {
    expect(getApiUrl()).toBe('http://localhost:8080/api/v1');
  });

  it('getApiUrl returns unversioned URL when versioned is false', () => {
    const custom: BackendConfig = {
      server: { port: 8080, host: 'localhost' },
      api: { basePath: '/rest', versioned: false },
    };
    expect(getApiUrl(custom)).toBe('http://localhost:8080/rest');
  });
});
