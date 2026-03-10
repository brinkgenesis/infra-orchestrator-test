export interface HealthStatus {
  healthy: boolean;
  uptime: number;
  checks: Record<string, { ok: boolean; message?: string }>;
}

export type HealthCheck = () => Promise<{ ok: boolean; message?: string }>;

export class HealthChecker {
  private checks = new Map<string, HealthCheck>();
  private startTime = Date.now();

  register(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
  }

  unregister(name: string): void {
    this.checks.delete(name);
  }

  async status(): Promise<HealthStatus> {
    const results: HealthStatus['checks'] = {};
    let healthy = true;

    for (const [name, check] of this.checks) {
      try {
        const result = await check();
        results[name] = result;
        if (!result.ok) healthy = false;
      } catch (err) {
        healthy = false;
        results[name] = {
          ok: false,
          message: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    }

    return {
      healthy,
      uptime: Date.now() - this.startTime,
      checks: results,
    };
  }
}
