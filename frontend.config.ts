interface FrontendConfig {
  dev: {
    port: number;
    hmr: boolean;
  };
  build: {
    outDir: string;
    sourcemap: boolean;
  };
}

/**
 * Frontend & DX configuration for the infra orchestrator.
 */
const config: FrontendConfig = {
  dev: {
    port: 3000,
    hmr: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
};

export default config;
