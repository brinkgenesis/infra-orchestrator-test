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

export interface Request {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface Response {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

export type Middleware = (req: Request, res: Response, next: () => void) => void;

export class Server {
  private config: AppConfig;
  private startTime: number | null = null;
  private routes: Route[] = [];
  private middlewares: Middleware[] = [];

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

  removeRoute(method: Route['method'], path: string): boolean {
    const index = this.routes.findIndex(r => r.method === method && r.path === path);
    if (index === -1) return false;
    this.routes.splice(index, 1);
    return true;
  }

  findRoute(method: Route['method'], path: string): Route | undefined {
    return this.routes.find(r => r.method === method && r.path === path);
  }

  getRoutes(): Route[] {
    return [...this.routes];
  }

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  getMiddlewares(): Middleware[] {
    return [...this.middlewares];
  }

  runMiddlewares(req: Request, res: Response): void {
    let index = 0;
    const next = (): void => {
      if (index < this.middlewares.length) {
        const mw = this.middlewares[index++]!;
        mw(req, res, next);
      }
    };
    next();
  }

  start(): void {
    this.startTime = Date.now();
  }

  stop(): void {
    this.startTime = null;
    this.routes = [];
    this.middlewares = [];
  }

  isRunning(): boolean {
    return this.startTime !== null;
  }

  getUptime(): number {
    return this.startTime !== null ? Date.now() - this.startTime : 0;
  }

  healthCheck(): HealthStatus {
    return {
      status: this.isRunning() ? 'ok' : 'error',
      uptime: this.getUptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

export function createServer(config?: AppConfig): Server {
  return new Server(config);
}
