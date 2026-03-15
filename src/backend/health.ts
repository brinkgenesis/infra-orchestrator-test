import type { AppConfig } from '../index';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  version: string;
}

export interface DependencyStatus {
  name: string;
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

export interface DetailedHealthStatus extends HealthStatus {
  dependencies: DependencyStatus[];
}

export type HealthProbe = () => Promise<boolean> | boolean;

export interface HealthChecker {
  /** Register a named dependency probe. */
  register(name: string, probe: HealthProbe): void;
  /** Unregister a dependency probe by name. */
  unregister(name: string): boolean;
  /** Run all probes and return aggregated health status. */
  check(version?: string): Promise<DetailedHealthStatus>;
  /** Return the list of registered dependency names. */
  list(): string[];
}

const startTime = Date.now();

/** Returns the current health status of the application including uptime and version info. */
export function getHealthStatus(version = '0.1.0'): HealthStatus {
  return {
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    version,
  };
}

/** Constructs the base HTTP URL from the given application config. */
export function buildBaseUrl(config: AppConfig): string {
  return `http://${config.host}:${config.port}`;
}

/** Maps a health status value to the corresponding HTTP status code. */
export function mapHealthStatusToHttpCode(status: HealthStatus['status']): number {
  switch (status) {
    case 'healthy':
      return 200;
    case 'degraded':
      return 207;
    case 'unhealthy':
      return 503;
  }
}

/** Creates a health checker that aggregates dependency probe results into an overall health status. */
export function createHealthChecker(): HealthChecker {
  const probes = new Map<string, HealthProbe>();

  return {
    register(name: string, probe: HealthProbe): void {
      probes.set(name, probe);
    },

    unregister(name: string): boolean {
      return probes.delete(name);
    },

    async check(version = '0.1.0'): Promise<DetailedHealthStatus> {
      const dependencies: DependencyStatus[] = [];

      for (const [name, probe] of probes) {
        const start = Date.now();
        try {
          const result = await probe();
          dependencies.push({
            name,
            status: result ? 'up' : 'down',
            latencyMs: Date.now() - start,
          });
        } catch (err) {
          dependencies.push({
            name,
            status: 'down',
            latencyMs: Date.now() - start,
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      const allUp = dependencies.every((d) => d.status === 'up');
      const allDown = dependencies.length > 0 && dependencies.every((d) => d.status === 'down');

      let status: HealthStatus['status'];
      if (dependencies.length === 0 || allUp) {
        status = 'healthy';
      } else if (allDown) {
        status = 'unhealthy';
      } else {
        status = 'degraded';
      }

      return {
        status,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        version,
        dependencies,
      };
    },

    list(): string[] {
      return [...probes.keys()];
    },
  };
}
