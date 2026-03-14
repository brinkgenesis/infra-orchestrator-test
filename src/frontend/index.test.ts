import { describe, it, expect } from 'vitest';
import {
  getDevServerUrl,
  getBuildOutDir,
  isSourcemapEnabled,
  isHmrEnabled,
  createFrontendConfig,
  getPublicUrl,
  getAssetPublicPath,
  resolveAssetUrl,
<<<<<<< HEAD
  isDevMode,
  isMinifyEnabled,
  getBuildTarget,
  getPublicDir,
  getAssetExtensions,
  getProxyConfig,
  shouldOpenBrowser,
  getDevProxyPaths,
  buildViteConfig,
  createPreviewConfig,
  frontendConfig,
=======
  diffConfigs,
  createDevEnvironment,
  createBuildEnvironment,
>>>>>>> 66093d5 (feat: add assets config support to frontend config and utilities)
  getAssetsConfig,
  resolveAssetPublicPath,
} from './index';
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

  it('shouldOpenBrowser returns true when open is enabled', () => {
    const cfg = createFrontendConfig({ dev: { open: true } });
    expect(shouldOpenBrowser(cfg)).toBe(true);
  });

  it('getDevProxyPaths returns proxy path keys from default config', () => {
    const paths = getDevProxyPaths();
    expect(paths).toContain('/api');
  });

  it('getDevProxyPaths returns empty array when no proxy configured', () => {
    expect(getDevProxyPaths(makeConfig())).toEqual([]);
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

    it('forwards proxy rewrite function when present', () => {
      const rewrite = (p: string) => p.replace(/^\/api/, '');
      const cfg = createFrontendConfig({
        dev: { proxy: { '/api': { target: 'http://localhost:4000', rewrite } } },
      });
      const vite = buildViteConfig(cfg);
      const server = vite['server'] as Record<string, unknown>;
      const proxy = server['proxy'] as Record<string, Record<string, unknown>>;
      expect(proxy['/api']!['rewrite']).toBe(rewrite);
    });

    it('omits rewrite key when not provided', () => {
      const cfg = createFrontendConfig({
        dev: { proxy: { '/api': { target: 'http://localhost:4000' } } },
      });
      const vite = buildViteConfig(cfg);
      const server = vite['server'] as Record<string, unknown>;
      const proxy = server['proxy'] as Record<string, Record<string, unknown>>;
      expect(proxy['/api']!['rewrite']).toBeUndefined();
    });
  });

  it('createFrontendConfig merges assets overrides', () => {
    const cfg = createFrontendConfig({ assets: { publicDir: 'static' } });
    expect(cfg.assets.publicDir).toBe('static');
  });

  describe('createPreviewConfig', () => {
    it('generates preview config with defaults', () => {
      const preview = createPreviewConfig();
      const previewSection = preview['preview'] as Record<string, unknown>;
      expect(previewSection['host']).toBe('localhost');
      expect(previewSection['port']).toBe(3001);
      expect(previewSection['strictPort']).toBe(false);
    });

    it('includes build settings from config', () => {
      const preview = createPreviewConfig();
      const build = preview['build'] as Record<string, unknown>;
      expect(build['outDir']).toBe('dist');
      expect(build['sourcemap']).toBe(true);
      expect(build['minify']).toBe(true);
      expect(build['target']).toBe('es2022');
    });

    it('respects custom options', () => {
      const preview = createPreviewConfig(undefined, { host: '0.0.0.0', port: 5000, strictPort: true });
      const previewSection = preview['preview'] as Record<string, unknown>;
      expect(previewSection['host']).toBe('0.0.0.0');
      expect(previewSection['port']).toBe(5000);
      expect(previewSection['strictPort']).toBe(true);
    });

    it('uses custom config for build settings', () => {
      const cfg = makeConfig({ build: { outDir: 'build', minify: false } });
      const preview = createPreviewConfig(cfg);
      const build = preview['build'] as Record<string, unknown>;
      expect(build['outDir']).toBe('build');
      expect(build['minify']).toBe(false);
    });

    it('defaults preview port to dev port + 1', () => {
      const cfg = makeConfig({ dev: { port: 8080 } });
      const preview = createPreviewConfig(cfg);
      const previewSection = preview['preview'] as Record<string, unknown>;
      expect(previewSection['port']).toBe(8081);
    });
  });

  it('createFrontendConfig passes through assets override', () => {
    const cfg = createFrontendConfig({ assets: { publicDir: 'static', extensions: ['png', 'webp'] } });
    expect(cfg.assets).toBeDefined();
    expect(cfg.assets.publicDir).toBe('static');
    expect(cfg.assets.extensions).toEqual(['png', 'webp']);
  });

  it('createFrontendConfig preserves default assets when not overridden', () => {
    const cfg = createFrontendConfig();
    expect(cfg.assets).toBeDefined();
    expect(cfg.assets.publicDir).toBe('public');
  });

  it('getAssetsConfig returns default when assets not set', () => {
    const assets = getAssetsConfig();
    expect(assets.publicDir).toBe('public');
    expect(assets.extensions).toContain('png');
  });

  it('getAssetsConfig returns config assets when set', () => {
    const cfg = createFrontendConfig({ assets: { publicDir: 'static', extensions: ['webp'] } });
    const assets = getAssetsConfig(cfg);
    expect(assets.publicDir).toBe('static');
    expect(assets.extensions).toEqual(['webp']);
  });

  it('resolveAssetPublicPath joins publicDir and filename', () => {
    expect(resolveAssetPublicPath('logo.png')).toBe('public/logo.png');
  });

  it('resolveAssetPublicPath strips leading slashes', () => {
    expect(resolveAssetPublicPath('/images/hero.jpg')).toBe('public/images/hero.jpg');
  });

  it('resolveAssetPublicPath respects custom assets config', () => {
    const cfg = createFrontendConfig({ assets: { publicDir: 'static/', extensions: ['svg'] } });
    expect(resolveAssetPublicPath('icon.svg', cfg)).toBe('static/icon.svg');
  });

  it('createFrontendConfig passes through assets override', () => {
    const cfg = createFrontendConfig({ assets: { publicDir: 'static', extensions: ['png', 'webp'] } });
    expect(cfg.assets).toBeDefined();
    expect(cfg.assets!.publicDir).toBe('static');
    expect(cfg.assets!.extensions).toEqual(['png', 'webp']);
  });

  it('createFrontendConfig omits assets when not provided', () => {
    const cfg = createFrontendConfig();
    expect(cfg.assets).toBeUndefined();
  });

  it('getAssetsConfig returns default when assets not set', () => {
    const assets = getAssetsConfig();
    expect(assets.publicDir).toBe('public');
    expect(assets.extensions).toContain('png');
  });

  it('getAssetsConfig returns config assets when set', () => {
    const cfg = createFrontendConfig({ assets: { publicDir: 'static', extensions: ['webp'] } });
    const assets = getAssetsConfig(cfg);
    expect(assets.publicDir).toBe('static');
    expect(assets.extensions).toEqual(['webp']);
  });

  it('resolveAssetPublicPath joins publicDir and filename', () => {
    expect(resolveAssetPublicPath('logo.png')).toBe('public/logo.png');
  });

  it('resolveAssetPublicPath strips leading slashes', () => {
    expect(resolveAssetPublicPath('/images/hero.jpg')).toBe('public/images/hero.jpg');
  });

  it('resolveAssetPublicPath respects custom assets config', () => {
    const cfg = createFrontendConfig({ assets: { publicDir: 'static/', extensions: ['svg'] } });
    expect(resolveAssetPublicPath('icon.svg', cfg)).toBe('static/icon.svg');
  });
});
