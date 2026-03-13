import { describe, it, expect } from 'vitest';
import { Server, createServer, Middleware, Request, Response } from './server';
import { defaultConfig } from '../index';

describe('Server', () => {
  it('should create with default config', () => {
    const server = new Server();
    expect(server.getConfig()).toEqual(defaultConfig);
  });

  it('should create with custom config', () => {
    const config = { port: 8080, host: '0.0.0.0', env: 'production' as const };
    const server = new Server(config);
    expect(server.getConfig()).toEqual(config);
  });

  it('should return correct address', () => {
    const server = new Server();
    expect(server.getAddress()).toBe('http://localhost:3000');
  });

  it('should manage routes', () => {
    const server = new Server();
    const route = { method: 'GET' as const, path: '/api/health', handler: 'healthCheck' };
    server.addRoute(route);
    expect(server.getRoutes()).toEqual([route]);
  });

  it('should find a route by method and path', () => {
    const server = new Server();
    const route = { method: 'GET' as const, path: '/api/users', handler: 'listUsers' };
    server.addRoute(route);
    expect(server.findRoute('GET', '/api/users')).toEqual(route);
    expect(server.findRoute('POST', '/api/users')).toBeUndefined();
    expect(server.findRoute('GET', '/api/posts')).toBeUndefined();
  });

  it('should remove a route by method and path', () => {
    const server = new Server();
    server.addRoute({ method: 'GET' as const, path: '/api/users', handler: 'listUsers' });
    server.addRoute({ method: 'POST' as const, path: '/api/users', handler: 'createUser' });

    expect(server.removeRoute('GET', '/api/users')).toBe(true);
    expect(server.getRoutes()).toHaveLength(1);
    expect(server.getRoutes()[0]?.method).toBe('POST');

    expect(server.removeRoute('DELETE', '/api/users')).toBe(false);
  });

  it('should track running state', () => {
    const server = new Server();
    expect(server.isRunning()).toBe(false);
    server.start();
    expect(server.isRunning()).toBe(true);
    server.stop();
    expect(server.isRunning()).toBe(false);
  });

  it('should return health status', () => {
    const server = new Server();
    const health = server.healthCheck();
    expect(health.status).toBe('error');
    expect(health.uptime).toBe(0);

    server.start();
    const runningHealth = server.healthCheck();
    expect(runningHealth.status).toBe('ok');
    expect(runningHealth.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should report uptime', () => {
    const server = new Server();
    expect(server.getUptime()).toBe(0);
    server.start();
    expect(server.getUptime()).toBeGreaterThanOrEqual(0);
  });

  it('should preserve routes and middlewares on stop for restart', () => {
    const server = new Server();
    server.addRoute({ method: 'GET' as const, path: '/test', handler: 'test' });
    server.use((_req, _res, next) => next());
    server.start();

    expect(server.getRoutes()).toHaveLength(1);
    expect(server.getMiddlewares()).toHaveLength(1);

    server.stop();
    expect(server.isRunning()).toBe(false);
    expect(server.getRoutes()).toHaveLength(1);
    expect(server.getMiddlewares()).toHaveLength(1);

    // Can restart with same routes/middlewares
    server.start();
    expect(server.isRunning()).toBe(true);
    expect(server.getRoutes()).toHaveLength(1);
  });

  it('should clear routes and middlewares on reset', () => {
    const server = new Server();
    server.addRoute({ method: 'GET' as const, path: '/test', handler: 'test' });
    server.use((_req, _res, next) => next());
    server.start();

    server.reset();
    expect(server.isRunning()).toBe(false);
    expect(server.getRoutes()).toHaveLength(0);
    expect(server.getMiddlewares()).toHaveLength(0);
  });

  it('should reject invalid port in constructor', () => {
    expect(() => new Server({ port: 0, host: 'localhost', env: 'test' })).toThrow(RangeError);
    expect(() => new Server({ port: -1, host: 'localhost', env: 'test' })).toThrow(RangeError);
    expect(() => new Server({ port: 70000, host: 'localhost', env: 'test' })).toThrow(RangeError);
    expect(() => new Server({ port: NaN, host: 'localhost', env: 'test' })).toThrow(RangeError);
    expect(() => new Server({ port: Infinity, host: 'localhost', env: 'test' })).toThrow(RangeError);
  });

  it('should accept valid port boundaries', () => {
    expect(() => new Server({ port: 1, host: 'localhost', env: 'test' })).not.toThrow();
    expect(() => new Server({ port: 65535, host: 'localhost', env: 'test' })).not.toThrow();
  });

  it('should support PATCH routes', () => {
    const server = new Server();
    const route = { method: 'PATCH' as const, path: '/api/users/1', handler: 'updateUser' };
    server.addRoute(route);
    expect(server.findRoute('PATCH', '/api/users/1')).toEqual(route);
  });

  it('createServer factory should work', () => {
    const server = createServer();
    expect(server).toBeInstanceOf(Server);
    expect(server.getConfig()).toEqual(defaultConfig);
  });

  it('should return route count', () => {
    const server = new Server();
    expect(server.getRouteCount()).toBe(0);
    server.addRoute({ method: 'GET', path: '/a', handler: 'a' });
    server.addRoute({ method: 'POST', path: '/b', handler: 'b' });
    expect(server.getRouteCount()).toBe(2);
  });

  it('should return middleware count', () => {
    const server = new Server();
    expect(server.getMiddlewareCount()).toBe(0);
    server.use((_req, _res, next) => next());
    expect(server.getMiddlewareCount()).toBe(1);
  });

  it('should return comprehensive status', () => {
    const server = new Server();
    const statusBefore = server.getStatus();
    expect(statusBefore.running).toBe(false);
    expect(statusBefore.uptime).toBe(0);
    expect(statusBefore.routes).toBe(0);
    expect(statusBefore.middlewares).toBe(0);

    server.addRoute({ method: 'GET', path: '/test', handler: 'test' });
    server.use((_req, _res, next) => next());
    server.start();

    const statusAfter = server.getStatus();
    expect(statusAfter.running).toBe(true);
    expect(statusAfter.uptime).toBeGreaterThanOrEqual(0);
    expect(statusAfter.routes).toBe(1);
    expect(statusAfter.middlewares).toBe(1);
  });

  it('hasRoute returns true for registered route', () => {
    const server = new Server();
    server.addRoute({ method: 'GET', path: '/api/users', handler: 'listUsers' });
    expect(server.hasRoute('GET', '/api/users')).toBe(true);
  });

  it('hasRoute returns false for unregistered route', () => {
    const server = new Server();
    expect(server.hasRoute('GET', '/api/users')).toBe(false);
  });

  it('hasRoute distinguishes method', () => {
    const server = new Server();
    server.addRoute({ method: 'GET', path: '/api/users', handler: 'listUsers' });
    expect(server.hasRoute('POST', '/api/users')).toBe(false);
  });

  it('listRoutePaths returns formatted route strings', () => {
    const server = new Server();
    server.addRoute({ method: 'GET', path: '/api/users', handler: 'listUsers' });
    server.addRoute({ method: 'POST', path: '/api/users', handler: 'createUser' });
    expect(server.listRoutePaths()).toEqual(['GET /api/users', 'POST /api/users']);
  });

  it('listRoutePaths returns empty array when no routes', () => {
    const server = new Server();
    expect(server.listRoutePaths()).toEqual([]);
  });
});

describe('Middleware', () => {
  it('should register and retrieve middlewares', () => {
    const server = new Server();
    const mw: Middleware = (_req, _res, next) => next();
    server.use(mw);
    expect(server.getMiddlewares()).toHaveLength(1);
  });

  it('should run middlewares in order', () => {
    const server = new Server();
    const order: number[] = [];

    server.use((_req, _res, next) => {
      order.push(1);
      next();
    });
    server.use((_req, _res, next) => {
      order.push(2);
      next();
    });
    server.use((_req, _res, next) => {
      order.push(3);
      next();
    });

    const req: Request = { method: 'GET', path: '/', headers: {} };
    const res: Response = { status: 200, headers: {} };
    server.runMiddlewares(req, res);

    expect(order).toEqual([1, 2, 3]);
  });

  it('should allow middleware to short-circuit the chain', () => {
    const server = new Server();
    const order: number[] = [];

    server.use((_req, res, _next) => {
      order.push(1);
      res.status = 401;
      // Don't call next — short-circuit
    });
    server.use((_req, _res, next) => {
      order.push(2);
      next();
    });

    const req: Request = { method: 'GET', path: '/admin', headers: {} };
    const res: Response = { status: 200, headers: {} };
    server.runMiddlewares(req, res);

    expect(order).toEqual([1]);
    expect(res.status).toBe(401);
  });

  it('should allow middleware to modify request and response', () => {
    const server = new Server();

    server.use((req, res, next) => {
      req.headers['x-request-id'] = 'abc-123';
      res.headers['x-powered-by'] = 'test-server';
      next();
    });

    const req: Request = { method: 'GET', path: '/', headers: {} };
    const res: Response = { status: 200, headers: {} };
    server.runMiddlewares(req, res);

    expect(req.headers['x-request-id']).toBe('abc-123');
    expect(res.headers['x-powered-by']).toBe('test-server');
  });
});
