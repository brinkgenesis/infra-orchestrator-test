import { describe, it, expect } from 'vitest';
import { getDevServerUrl, getBuildOutDir, isSourcemapEnabled, isHmrEnabled, createFrontendConfig, getPublicUrl, getAssetPublicPath, resolveAssetUrl, isDevMode, isMinifyEnabled, getBuildTarget, getPublicDir, getAssetExtensions, getProxyConfig, shouldOpenBrowser, buildViteConfig, validateFrontendConfig, frontendConfig } from './index';
import type { FrontendConfig } from './index';

function makeConfig(overrides: {
  dev?: Partial<FrontendConfig['dev']>;
  build?: Partial<FrontendConfig['build']>;
  assets?: Partial<FrontendConfig['assets']>;
} = {}): FrontendConfig {
  return {
    dev: { port: 3000, hmr: true, proxy: {}, open: false, ...overrides.dev },
    build: { outDir: 'dist', sourcemap: true, minify: false, target: 'es2022', ...overrides.build },
    assets: { publicDir: 'public', extensions: [], ...overrides.assets },
  };
}

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
    expect(getDevServerUrl(makeConfig({ dev: { port: 8080, hmr: false } }))).toBe('http://localhost:8080');
  });

  it('getBuildOutDir returns correct output directory', () => {
    expect(getBuildOutDir()).toBe('dist');
  });

  it('getBuildOutDir respects custom config', () => {
    expect(getBuildOutDir(makeConfig({ build: { outDir: 'build' } }))).toBe('build');
  });

  it('isSourcemapEnabled returns correct default', () => {
    expect(isSourcemapEnabled()).toBe(true);
  });

  it('isSourcemapEnabled respects custom config', () => {
    expect(isSourcemapEnabled(makeConfig({ build: { sourcemap: false } }))).toBe(false);
  });

  it('isHmrEnabled returns correct default', () => {
    expect(isHmrEnabled()).toBe(true);
  });

  it('isHmrEnabled respects custom config', () => {
    expect(isHmrEnabled(makeConfig({ dev: { hmr: false } }))).toBe(false);
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
    expect(getPublicUrl('/app', makeConfig({ dev: { port: 9000 } }))).toBe('http://localhost:9000/app');
  });

  it('getAssetPublicPath returns path based on outDir', () => {
    expect(getAssetPublicPath()).toBe('/dist/');
  });

  it('getAssetPublicPath respects custom config', () => {
    expect(getAssetPublicPath(makeConfig({ build: { outDir: 'build' } }))).toBe('/build/');
  });

  it('resolveAssetUrl joins base path with asset name', () => {
    expect(resolveAssetUrl('main.js')).toBe('/dist/main.js');
  });

  it('resolveAssetUrl strips leading slashes from asset name', () => {
    expect(resolveAssetUrl('/images/logo.png')).toBe('/dist/images/logo.png');
  });

  it('resolveAssetUrl respects custom config', () => {
    expect(resolveAssetUrl('style.css', makeConfig({ build: { outDir: 'public' } }))).toBe('/public/style.css');
  });

  it('isDevMode returns true when hmr enabled and port > 0', () => {
    expect(isDevMode()).toBe(true);
  });

  it('isDevMode returns false when hmr disabled', () => {
    expect(isDevMode(makeConfig({ dev: { hmr: false } }))).toBe(false);
  });

  it('isMinifyEnabled returns true from default config', () => {
    expect(isMinifyEnabled()).toBe(true);
  });

  it('isMinifyEnabled returns false when not enabled', () => {
    expect(isMinifyEnabled(makeConfig({ build: { minify: false } }))).toBe(false);
  });

  it('getBuildTarget returns default config target', () => {
    expect(getBuildTarget()).toBe('es2022');
  });

  it('getBuildTarget returns custom target', () => {
    expect(getBuildTarget(makeConfig({ build: { target: 'esnext' } }))).toBe('esnext');
  });

  it('getPublicDir returns public from default config', () => {
    expect(getPublicDir()).toBe('public');
  });

  it('getPublicDir returns custom publicDir', () => {
    expect(getPublicDir(makeConfig({ assets: { publicDir: 'static' } }))).toBe('static');
  });

  it('getAssetExtensions returns configured extensions', () => {
    const exts = getAssetExtensions();
    expect(exts).toContain('png');
    expect(exts).toContain('svg');
  });

  it('getAssetExtensions returns custom extensions', () => {
    expect(getAssetExtensions(makeConfig({ assets: { extensions: ['gif'] } }))).toEqual(['gif']);
  });

  it('getProxyConfig returns proxy map', () => {
    const proxy = getProxyConfig();
    expect(proxy['/api']).toBeDefined();
    expect(proxy['/api']?.target).toBe('http://localhost:4000');
  });

  it('getProxyConfig returns empty object when no proxy', () => {
    expect(getProxyConfig(makeConfig())).toEqual({});
  });

  it('shouldOpenBrowser returns false by default', () => {
    expect(shouldOpenBrowser()).toBe(false);
  });

  describe('buildViteConfig', () => {
    it('generates valid vite config from defaults', () => {
      const vite = buildViteConfig();
      expect(vite['root']).toBe('.');
      expect(vite['base']).toBe('/');
      expect(vite['mode']).toBe('development');
      expect((vite['server'] as Record<string, unknown>)['port']).toBe(3000);
      expect((vite['build'] as Record<string, unknown>)['outDir']).toBe('dist');
      expect(vite['publicDir']).toBe('public');
    });

    it('disables minify in development mode', () => {
      const vite = buildViteConfig();
      expect((vite['build'] as Record<string, unknown>)['minify']).toBe(false);
    });

    it('enables minify in production mode', () => {
      const vite = buildViteConfig(undefined, { mode: 'production' });
      expect((vite['build'] as Record<string, unknown>)['minify']).toBe(true);
    });

    it('respects custom options', () => {
      const vite = buildViteConfig(undefined, { root: './app', base: '/app/', mode: 'production' });
      expect(vite['root']).toBe('./app');
      expect(vite['base']).toBe('/app/');
      expect(vite['mode']).toBe('production');
    });

    it('includes proxy config in server section', () => {
      const vite = buildViteConfig();
      const server = vite['server'] as Record<string, unknown>;
      const proxy = server['proxy'] as Record<string, unknown>;
      expect(proxy['/api']).toBeDefined();
    });
  });

  it('createFrontendConfig merges assets overrides', () => {
    const cfg = createFrontendConfig({ assets: { publicDir: 'static' } });
    expect(cfg.assets.publicDir).toBe('static');
  });

  describe('validateFrontendConfig', () => {
    it('returns no errors for valid default config', () => {
      expect(validateFrontendConfig()).toEqual([]);
    });

    it('returns no errors for valid custom config', () => {
      expect(validateFrontendConfig(makeConfig())).toEqual([]);
    });

    it('detects invalid port (0)', () => {
      const errors = validateFrontendConfig(makeConfig({ dev: { port: 0 } }));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid dev port');
    });

    it('detects invalid port (negative)', () => {
      const errors = validateFrontendConfig(makeConfig({ dev: { port: -1 } } as never));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid dev port');
    });

    it('detects invalid port (too high)', () => {
      const errors = validateFrontendConfig(makeConfig({ dev: { port: 70000 } }));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid dev port');
    });

    it('detects fractional port', () => {
      const errors = validateFrontendConfig(makeConfig({ dev: { port: 3000.5 } }));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid dev port');
    });

    it('detects empty outDir', () => {
      const errors = validateFrontendConfig(makeConfig({ build: { outDir: '  ' } }));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('outDir must not be empty');
    });

    it('detects invalid build target', () => {
      const errors = validateFrontendConfig(makeConfig({ build: { target: 'es5' } }));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid build target');
    });

    it('collects multiple errors', () => {
      const errors = validateFrontendConfig(makeConfig({ dev: { port: 0 }, build: { outDir: '', target: 'invalid' } }));
      expect(errors).toHaveLength(3);
    });
  });
});
