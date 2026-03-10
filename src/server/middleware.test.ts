import { describe, it, expect } from 'vitest';
import { createRequestContext, getRequestDuration } from './middleware';
import { createServerContext } from './index';

describe('middleware', () => {
  const serverContext = createServerContext();

  it('creates a request context with unique IDs', () => {
    const ctx1 = createRequestContext(serverContext);
    const ctx2 = createRequestContext(serverContext);
    expect(ctx1.requestId).not.toBe(ctx2.requestId);
    expect(ctx1.requestId).toMatch(/^req_\d+_\d+$/);
  });

  it('includes server context', () => {
    const ctx = createRequestContext(serverContext);
    expect(ctx.serverContext).toBe(serverContext);
  });

  it('tracks request timestamp', () => {
    const before = Date.now();
    const ctx = createRequestContext(serverContext);
    const after = Date.now();
    expect(ctx.timestamp).toBeGreaterThanOrEqual(before);
    expect(ctx.timestamp).toBeLessThanOrEqual(after);
  });

  it('calculates request duration', () => {
    const ctx = createRequestContext(serverContext);
    const duration = getRequestDuration(ctx);
    expect(duration).toBeGreaterThanOrEqual(0);
  });
});
