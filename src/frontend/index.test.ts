import { describe, it, expect } from 'vitest';
import { getDevServerUrl, getBuildOutDir, isSourcemapEnabled, isHmrEnabled, createFrontendConfig, getDevServerConfig, getBuildConfig, validateFrontendConfig, resolveOutPath, formatDevBanner, getConfigSnapshot, frontendConfig, createDevProxyConfig, createConfigFromEnv, mergeConfigs, getAssetPath } from './index';
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

  it('getDevServerConfig returns summary object with defaults', () => {
    const result = getDevServerConfig();
    expect(result.url).toBe('http://localhost:3000');
    expect(result.port).toBe(3000);
    expect(result.hmr).toBe(true);
  });

  it('getDevServerConfig respects custom config', () => {
    const custom: FrontendConfig = {
      dev: { port: 9000, hmr: false },
      build: { outDir: 'dist', sourcemap: true },
    };
    const result = getDevServerConfig(custom);
    expect(result.url).toBe('http://localhost:9000');
    expect(result.port).toBe(9000);
    expect(result.hmr).toBe(false);
  });

  it('getBuildConfig returns summary object with defaults', () => {
    const result = getBuildConfig();
    expect(result.outDir).toBe('dist');
    expect(result.sourcemap).toBe(true);
  });

  it('getBuildConfig respects custom config', () => {
    const custom: FrontendConfig = {
      dev: { port: 3000, hmr: true },
      build: { outDir: 'output', sourcemap: false },
    };
    const result = getBuildConfig(custom);
    expect(result.outDir).toBe('output');
    expect(result.sourcemap).toBe(false);
  });

  it('validateFrontendConfig returns no errors for valid config', () => {
    expect(validateFrontendConfig(frontendConfig)).toEqual([]);
  });

  it('validateFrontendConfig catches invalid port', () => {
    const bad: FrontendConfig = {
      dev: { port: 0, hmr: true },
      build: { outDir: 'dist', sourcemap: true },
    };
    const errors = validateFrontendConfig(bad);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Invalid port');
  });

  it('validateFrontendConfig catches empty outDir', () => {
    const bad: FrontendConfig = {
      dev: { port: 3000, hmr: true },
      build: { outDir: '', sourcemap: true },
    };
    const errors = validateFrontendConfig(bad);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('output directory');
  });

  it('validateFrontendConfig catches multiple errors', () => {
    const bad: FrontendConfig = {
      dev: { port: 99999, hmr: true },
      build: { outDir: '  ', sourcemap: true },
    };
    const errors = validateFrontendConfig(bad);
    expect(errors).toHaveLength(2);
  });

  it('validateFrontendConfig accepts boundary ports 1 and 65535', () => {
    const low: FrontendConfig = { dev: { port: 1, hmr: true }, build: { outDir: 'dist', sourcemap: true } };
    const high: FrontendConfig = { dev: { port: 65535, hmr: true }, build: { outDir: 'dist', sourcemap: true } };
    expect(validateFrontendConfig(low)).toEqual([]);
    expect(validateFrontendConfig(high)).toEqual([]);
  });

  it('validateFrontendConfig rejects negative port', () => {
    const bad: FrontendConfig = { dev: { port: -1, hmr: true }, build: { outDir: 'dist', sourcemap: true } };
    const errors = validateFrontendConfig(bad);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Invalid port');
  });

  it('resolveOutPath joins outDir and filePath', () => {
    expect(resolveOutPath('main.js')).toBe('dist/main.js');
  });

  it('resolveOutPath strips leading slashes from filePath', () => {
    expect(resolveOutPath('/assets/style.css')).toBe('dist/assets/style.css');
  });

  it('resolveOutPath strips trailing slashes from outDir', () => {
    const cfg: FrontendConfig = { dev: { port: 3000, hmr: true }, build: { outDir: 'build/', sourcemap: true } };
    expect(resolveOutPath('index.html', cfg)).toBe('build/index.html');
  });

  it('formatDevBanner includes port and HMR status', () => {
    expect(formatDevBanner()).toBe('Dev server: http://localhost:3000 | HMR: enabled');
  });

  it('formatDevBanner shows disabled when HMR is off', () => {
    const cfg: FrontendConfig = { dev: { port: 4000, hmr: false }, build: { outDir: 'dist', sourcemap: true } };
    expect(formatDevBanner(cfg)).toBe('Dev server: http://localhost:4000 | HMR: disabled');
  });

  it('getConfigSnapshot returns JSON string of config', () => {
    const snapshot = getConfigSnapshot();
    const parsed = JSON.parse(snapshot);
    expect(parsed.dev.port).toBe(3000);
    expect(parsed.build.outDir).toBe('dist');
  });

  it('createDevProxyConfig returns proxy config with defaults', () => {
    const proxy = createDevProxyConfig('http://localhost:8080');
    expect(proxy.target).toBe('http://localhost:8080');
    expect(proxy.changeOrigin).toBe(true);
    expect(proxy.pathRewrite).toEqual({ '/api': '/api' });
  });

  it('createDevProxyConfig accepts custom rewrites', () => {
    const proxy = createDevProxyConfig('http://localhost:8080', { '/api': '/v2/api' });
    expect(proxy.pathRewrite).toEqual({ '/api': '/v2/api' });
  });

  it('createConfigFromEnv uses defaults when env is empty', () => {
    const cfg = createConfigFromEnv({});
    expect(cfg.dev.port).toBe(3000);
    expect(cfg.dev.hmr).toBe(true);
    expect(cfg.build.outDir).toBe('dist');
    expect(cfg.build.sourcemap).toBe(true);
  });

  it('createConfigFromEnv reads DEV_PORT from env', () => {
    const cfg = createConfigFromEnv({ DEV_PORT: '4000' });
    expect(cfg.dev.port).toBe(4000);
  });

  it('createConfigFromEnv falls back on invalid DEV_PORT', () => {
    const cfg = createConfigFromEnv({ DEV_PORT: 'abc' });
    expect(cfg.dev.port).toBe(3000);
  });

  it('createConfigFromEnv reads HMR=false', () => {
    const cfg = createConfigFromEnv({ HMR: 'false' });
    expect(cfg.dev.hmr).toBe(false);
  });

  it('createConfigFromEnv reads OUT_DIR and SOURCEMAP', () => {
    const cfg = createConfigFromEnv({ OUT_DIR: 'build', SOURCEMAP: 'false' });
    expect(cfg.build.outDir).toBe('build');
    expect(cfg.build.sourcemap).toBe(false);
  });

  it('mergeConfigs merges two configs', () => {
    const base: FrontendConfig = { dev: { port: 3000, hmr: true }, build: { outDir: 'dist', sourcemap: true } };
    const result = mergeConfigs(base, { dev: { port: 5000 } });
    expect(result.dev.port).toBe(5000);
    expect(result.dev.hmr).toBe(true);
    expect(result.build.outDir).toBe('dist');
  });

  it('getAssetPath inserts hash before extension', () => {
    expect(getAssetPath('main.js', 'abc123')).toBe('dist/main.abc123.js');
  });

  it('getAssetPath handles nested paths', () => {
    expect(getAssetPath('/assets/style.css', 'def456')).toBe('dist/assets/style.def456.css');
  });

  it('getAssetPath handles files without extension', () => {
    expect(getAssetPath('LICENSE', 'aaa')).toBe('dist/LICENSE.aaa');
  });
});
