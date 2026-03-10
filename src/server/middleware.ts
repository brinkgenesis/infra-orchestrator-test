import type { ServerContext } from './index';

export interface RequestContext {
  requestId: string;
  timestamp: number;
  serverContext: ServerContext;
}

let requestCounter = 0;

export function createRequestContext(
  serverContext: ServerContext,
): RequestContext {
  return {
    requestId: `req_${Date.now()}_${++requestCounter}`,
    timestamp: Date.now(),
    serverContext,
  };
}

export function getRequestDuration(ctx: RequestContext): number {
  return Date.now() - ctx.timestamp;
}
