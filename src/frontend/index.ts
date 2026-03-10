import config from '../../frontend.config';
import type { FrontendConfig } from '../../frontend.config';

export type { FrontendConfig };

export function getDevServerUrl(cfg: FrontendConfig = config): string {
  return `http://localhost:${cfg.dev.port}`;
}

export { config as frontendConfig };
