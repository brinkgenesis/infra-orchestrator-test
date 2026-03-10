import { describe, it, expect } from 'vitest';
import { getDevServerUrl, getBuildOutDir, isSourcemapEnabled, isHmrEnabled, createFrontendConfig, getPublicUrl, getAssetPublicPath, resolveAssetUrl, isDevMode, frontendConfig } from './index';
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

  it('isHmrEnabled returns correct default', () => {
    expect(isHmrEnabled()).toBe(true);
  });

  it('isHmrEnabled respects custom config', () => {
    const custom: FrontendConfig = {
      dev: { port: 3000, hmr: false },
      build: { outDir: 'dist', sourcemap: true },
    };
    expect(isHmrEnabled(custom)).toBe(false);
  });

  it('createFrontendConfig returns defaults when no overrides', () => {
    const cfg = createFrontendConfig();
    expect(cfg.dev.port).toBe(3000);
    expect(cfg.dev.hmr).toBe(true);
    expect(cfg.build.outDir).toBe('dist');
    expect(cfg.build.sourcemap).toBe(true);
  });

  it('createFrontendConfig merges partial overrides', () => {
    const cfg = createFrontendConfig({ dev: { port: 4000 }, build: { sourcemap: false } });
    expect(cfg.dev.port).toBe(4000);
    expect(cfg.dev.hmr).toBe(true);
    expect(cfg.build.outDir).toBe('dist');
    expect(cfg.build.sourcemap).toBe(false);
  });

  it('getPublicUrl returns base URL with default path', () => {
    expect(getPublicUrl()).toBe('http://localhost:3000/');
  });

  it('getPublicUrl appends path correctly', () => {
    expect(getPublicUrl('/assets/main.js')).toBe('http://localhost:3000/assets/main.js');
  });

  it('getPublicUrl normalizes path without leading slash', () => {
    expect(getPublicUrl('api/data')).toBe('http://localhost:3000/api/data');
  });

  it('getPublicUrl respects custom config', () => {
    const custom: FrontendConfig = {
      dev: { port: 9000, hmr: false },
      build: { outDir: 'dist', sourcemap: true },
    };
    expect(getPublicUrl('/app', custom)).toBe('http://localhost:9000/app');
  });

  it('getAssetPublicPath returns path based on outDir', () => {
    expect(getAssetPublicPath()).toBe('/dist/');
  });

  it('getAssetPublicPath respects custom config', () => {
    const custom: FrontendConfig = {
      dev: { port: 3000, hmr: true },
      build: { outDir: 'build', sourcemap: false },
    };
    expect(getAssetPublicPath(custom)).toBe('/build/');
  });

  it('resolveAssetUrl joins base path with asset name', () => {
    expect(resolveAssetUrl('main.js')).toBe('/dist/main.js');
  });

  it('resolveAssetUrl strips leading slashes from asset name', () => {
    expect(resolveAssetUrl('/images/logo.png')).toBe('/dist/images/logo.png');
  });

  it('resolveAssetUrl respects custom config', () => {
    const custom: FrontendConfig = {
      dev: { port: 3000, hmr: true },
      build: { outDir: 'public', sourcemap: false },
    };
    expect(resolveAssetUrl('style.css', custom)).toBe('/public/style.css');
  });

  it('isDevMode returns true when hmr enabled and port > 0', () => {
    expect(isDevMode()).toBe(true);
  });

  it('isDevMode returns false when hmr disabled', () => {
    const custom: FrontendConfig = {
      dev: { port: 3000, hmr: false },
      build: { outDir: 'dist', sourcemap: true },
    };
    expect(isDevMode(custom)).toBe(false);
  });
});
