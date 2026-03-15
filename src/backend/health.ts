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

export interface DependencyHealth {
  name: string;
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
}

export interface HealthCheckResult {
  status: HealthStatus['status'];
  version: string;
  uptime: number;
  timestamp: string;
  dependencies: DependencyHealth[];
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

/** Maps a health status string to the appropriate HTTP status code. */
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

/** Creates a health checker that manages named probes and aggregates their results. */
export function createHealthChecker() {
  const probes = new Map<string, HealthProbe>();

  return {
    register(name: string, probe: HealthProbe): void {
      probes.set(name, probe);
    },

    unregister(name: string): boolean {
      return probes.delete(name);
    },

    list(): string[] {
      return [...probes.keys()];
    },

    async check(version = '0.1.0'): Promise<HealthCheckResult> {
      const dependencies: DependencyHealth[] = [];

      for (const [name, probe] of probes) {
        const start = Date.now();
        let up = false;
        let message: string | undefined;

        try {
          up = await probe();
        } catch (err: unknown) {
          up = false;
          message = err instanceof Error ? err.message : 'Unknown error';
        }

        const latencyMs = Date.now() - start;
        const dep: DependencyHealth = {
          name,
          status: up ? 'up' : 'down',
          latencyMs,
        };
        if (message !== undefined) {
          dep.message = message;
        }
        dependencies.push(dep);
      }

      let status: HealthStatus['status'];
      if (dependencies.length === 0) {
        status = 'healthy';
      } else {
        const upCount = dependencies.filter((d) => d.status === 'up').length;
        if (upCount === dependencies.length) {
          status = 'healthy';
        } else if (upCount === 0) {
          status = 'unhealthy';
        } else {
          status = 'degraded';
        }
      }

      return {
        status,
        version,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        dependencies,
      };
    },
  };
}
