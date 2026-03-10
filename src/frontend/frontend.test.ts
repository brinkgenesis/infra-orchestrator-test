import { describe, it, expect } from 'vitest';
import { getDevServerUrl, frontendConfig } from './index';
import { createDevTools, getBuildOutputPath } from './devtools';

describe('frontend config', () => {
  it('should have valid dev server settings', () => {
    expect(frontendConfig.dev.port).toBeGreaterThan(0);
    expect(frontendConfig.dev.hmr).toBe(true);
  });

  it('should have valid build settings', () => {
    expect(frontendConfig.build.outDir).toBe('dist');
    expect(frontendConfig.build.sourcemap).toBe(true);
  });
});

describe('getDevServerUrl', () => {
  it('should return correct URL from default config', () => {
    expect(getDevServerUrl()).toBe('http://localhost:3000');
  });

  it('should use custom config port', () => {
    const url = getDevServerUrl({ dev: { port: 8080, hmr: false }, build: { outDir: 'dist', sourcemap: false } });
    expect(url).toBe('http://localhost:8080');
  });
});

describe('createDevTools', () => {
  it('should return devtools with default options', () => {
    const tools = createDevTools(frontendConfig);
    expect(tools.url).toBe('http://localhost:3000');
    expect(tools.hmr).toBe(true);
    expect(tools.overlay).toBe(true);
    expect(tools.logging).toBe('errors');
  });

  it('should respect custom options', () => {
    const tools = createDevTools(frontendConfig, { overlay: false, logging: 'verbose' });
    expect(tools.overlay).toBe(false);
    expect(tools.logging).toBe('verbose');
  });
});

describe('getBuildOutputPath', () => {
  it('should return the configured output directory', () => {
    expect(getBuildOutputPath(frontendConfig)).toBe('dist');
  });
});
