import { describe, it, expect } from 'vitest';
import { getDevServerUrl, getBuildOutDir, isSourcemapEnabled, frontendConfig } from './index';
import type { FrontendConfig } from './index';

describe('frontend config', () => {
  it('exports a valid config object', () => {
    expect(frontendConfig).toBeDefined();
    expect(frontendConfig.dev.port).toBe(3000);
    expect(frontendConfig.dev.hmr).toBe(true);
    expect(frontendConfig.build.outDir).toBe('dist');
    expect(frontendConfig.build.sourcemap).toBe(true);
  });

  it('getDevServerUrl returns correct URL with default config', () => {
    expect(getDevServerUrl()).toBe('http://localhost:3000');
  });

  it('getDevServerUrl respects custom config', () => {
    const custom: FrontendConfig = {
      dev: { port: 8080, hmr: false },
      build: { outDir: 'build', sourcemap: false },
    };
    expect(getDevServerUrl(custom)).toBe('http://localhost:8080');
  });

  it('getBuildOutDir returns correct output directory', () => {
    expect(getBuildOutDir()).toBe('dist');
  });

  it('getBuildOutDir respects custom config', () => {
    const custom: FrontendConfig = {
      dev: { port: 3000, hmr: true },
      build: { outDir: 'build', sourcemap: false },
    };
    expect(getBuildOutDir(custom)).toBe('build');
  });

  it('isSourcemapEnabled returns correct default', () => {
    expect(isSourcemapEnabled()).toBe(true);
  });

  it('isSourcemapEnabled respects custom config', () => {
    const custom: FrontendConfig = {
      dev: { port: 3000, hmr: true },
      build: { outDir: 'dist', sourcemap: false },
    };
    expect(isSourcemapEnabled(custom)).toBe(false);
  });
});
