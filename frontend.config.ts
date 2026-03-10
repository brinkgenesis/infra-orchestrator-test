export interface DevProxyTarget {
  target: string;
  changeOrigin?: boolean;
  rewrite?: (path: string) => string;
}

export interface FrontendConfig {
  dev: {
    port: number;
    hmr: boolean;
    proxy?: Record<string, DevProxyTarget>;
    open?: boolean;
  };
  build: {
    outDir: string;
    sourcemap: boolean;
    minify?: boolean;
    target?: string;
  };
  assets?: {
    publicDir: string;
    extensions: readonly string[];
  };
}

/**
 * Frontend & DX configuration for the infra orchestrator.
 */
const config: FrontendConfig = {
  dev: {
    port: 3000,
    hmr: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: true,
    target: 'es2022',
  },
  assets: {
    publicDir: 'public',
    extensions: ['png', 'jpg', 'svg', 'woff2', 'woff'] as const,
  },
};

export default config;
