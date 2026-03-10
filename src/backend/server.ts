import { AppConfig, defaultConfig } from '../index';

export interface HealthStatus {
  status: 'ok' | 'error';
  uptime: number;
  timestamp: string;
}

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: string;
}

export class Server {
  private config: AppConfig;
  private startTime: number | null = null;
  private routes: Route[] = [];

  constructor(config: AppConfig = defaultConfig) {
    this.config = config;
  }

  getConfig(): AppConfig {
    return this.config;
  }

  getAddress(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  addRoute(route: Route): void {
    this.routes.push(route);
  }

  getRoutes(): Route[] {
    return [...this.routes];
  }

  start(): void {
    this.startTime = Date.now();
  }

  stop(): void {
    this.startTime = null;
  }

  isRunning(): boolean {
    return this.startTime !== null;
  }

  healthCheck(): HealthStatus {
    return {
      status: this.isRunning() ? 'ok' : 'error',
      uptime: this.startTime !== null ? Date.now() - this.startTime : 0,
      timestamp: new Date().toISOString(),
    };
  }
}

export function createServer(config?: AppConfig): Server {
  return new Server(config);
}
