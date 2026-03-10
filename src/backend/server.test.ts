import { describe, it, expect } from 'vitest';
import { Server, createServer } from './server';
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

  it('createServer factory should work', () => {
    const server = createServer();
    expect(server).toBeInstanceOf(Server);
    expect(server.getConfig()).toEqual(defaultConfig);
  });
});
