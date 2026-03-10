import { describe, it, expect } from 'vitest';
import {
  getDevServerUrl,
  frontendConfig,
  resolveFrontendConfig,
  isHmrEnabled,
  getProxyEntries,
  getBuildTarget,
  hasSourcemaps,
  createFrontendConfig,
} from './index';

describe('frontend', () => {
  it('returns default dev server URL', () => {
    expect(getDevServerUrl()).toBe('http://localhost:3000');
  });

  it('uses custom port from config', () => {
    const url = getDevServerUrl({
      dev: { port: 8080, hmr: true, open: false, proxy: {} },
      build: { outDir: 'dist', sourcemap: false, minify: true, target: 'es2022' },
    });
    expect(url).toBe('http://localhost:8080');
  });

  it('exports frontend config with expected defaults', () => {
    expect(frontendConfig.dev.hmr).toBe(true);
    expect(frontendConfig.dev.open).toBe(false);
    expect(frontendConfig.build.outDir).toBe('dist');
    expect(frontendConfig.build.minify).toBe(true);
  });

  it('resolves config with partial overrides', () => {
    const resolved = resolveFrontendConfig({ dev: { port: 4000 } });
    expect(resolved.dev.port).toBe(4000);
    expect(resolved.dev.hmr).toBe(true);
    expect(resolved.build.outDir).toBe('dist');
  });

  it('returns default config when no overrides provided', () => {
    const resolved = resolveFrontendConfig();
    expect(resolved).toBe(frontendConfig);
  });
});

describe('frontend DX utilities', () => {
  it('isHmrEnabled returns true by default', () => {
    expect(isHmrEnabled()).toBe(true);
  });

  it('isHmrEnabled returns false when HMR is disabled', () => {
    const cfg = createFrontendConfig({ dev: { hmr: false } });
    expect(isHmrEnabled(cfg)).toBe(false);
  });

  it('getProxyEntries returns empty array by default', () => {
    expect(getProxyEntries()).toEqual([]);
  });

  it('getProxyEntries returns configured proxies', () => {
    const cfg = createFrontendConfig({ dev: { proxy: { '/api': 'http://localhost:4000' } } });
    expect(getProxyEntries(cfg)).toEqual([['/api', 'http://localhost:4000']]);
  });

  it('getBuildTarget returns ES2022 by default', () => {
    expect(getBuildTarget()).toBe('ES2022');
  });

  it('getBuildTarget returns custom target', () => {
    const cfg = createFrontendConfig({ build: { target: 'ES2020' } });
    expect(getBuildTarget(cfg)).toBe('ES2020');
  });

  it('hasSourcemaps returns true by default', () => {
    expect(hasSourcemaps()).toBe(true);
  });

  it('hasSourcemaps returns false when disabled', () => {
    const cfg = createFrontendConfig({ build: { sourcemap: false } });
    expect(hasSourcemaps(cfg)).toBe(false);
  });
});
