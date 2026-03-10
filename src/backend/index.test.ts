import { describe, it, expect } from 'vitest';
import { createServerStatus, getServerAddress, isProduction } from './index';
import type { AppConfig } from '../index';

describe('createServerStatus', () => {
  it('should return initial server status', () => {
    const status = createServerStatus();
    expect(status.running).toBe(false);
    expect(status.uptime).toBe(0);
    expect(status.requestCount).toBe(0);
  });
});

describe('getServerAddress', () => {
  it('should return default address when no config provided', () => {
    expect(getServerAddress()).toBe('http://localhost:3000');
  });

  it('should use custom config', () => {
    const config: AppConfig = { port: 9090, host: '127.0.0.1', env: 'test' };
    expect(getServerAddress(config)).toBe('http://127.0.0.1:9090');
  });
});

describe('isProduction', () => {
  it('should return false for development', () => {
    const config: AppConfig = { port: 3000, host: 'localhost', env: 'development' };
    expect(isProduction(config)).toBe(false);
  });

  it('should return true for production', () => {
    const config: AppConfig = { port: 3000, host: 'localhost', env: 'production' };
    expect(isProduction(config)).toBe(true);
  });

  it('should return false for test', () => {
    const config: AppConfig = { port: 3000, host: 'localhost', env: 'test' };
    expect(isProduction(config)).toBe(false);
  });

  it('should default to non-production', () => {
    expect(isProduction()).toBe(false);
  });
});
