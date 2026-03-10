import type { FrontendConfig } from '../../frontend.config';

export interface DevToolsOptions {
  overlay: boolean;
  logging: 'verbose' | 'errors' | 'silent';
}

const defaultOptions: DevToolsOptions = {
  overlay: true,
  logging: 'errors',
};

export function createDevTools(
  config: FrontendConfig,
  options: DevToolsOptions = defaultOptions,
): { url: string; hmr: boolean; overlay: boolean; logging: string } {
  return {
    url: `http://localhost:${config.dev.port}`,
    hmr: config.dev.hmr,
    overlay: options.overlay,
    logging: options.logging,
  };
}

export function getBuildOutputPath(config: FrontendConfig): string {
  return config.build.outDir;
}
