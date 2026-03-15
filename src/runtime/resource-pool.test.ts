import { describe, it, expect, vi } from 'vitest';
import {
  ResourcePool,
  AcquireTimeoutError,
  PoolClosedError,
} from './resource-pool';

function makeCounter() {
  let id = 0;
  return {
    create: async () => ++id,
    destroy: vi.fn(async (_n: number) => {}),
  };
}

describe('ResourcePool', () => {
  it('creates a resource on first acquire', async () => {
    const { create, destroy } = makeCounter();
    const pool = new ResourcePool({ create, destroy, maxSize: 2 });
    const r = await pool.acquire();
    expect(r).toBe(1);
    pool.release(r);
    await pool.close();
  });

  it('reuses idle resources', async () => {
    const { create, destroy } = makeCounter();
    const pool = new ResourcePool({ create, destroy, maxSize: 2 });
    const r1 = await pool.acquire();
    pool.release(r1);
    const r2 = await pool.acquire();
    expect(r2).toBe(1); // same resource reused
    pool.release(r2);
    await pool.close();
  });

  it('creates up to maxSize resources', async () => {
    const { create, destroy } = makeCounter();
    const pool = new ResourcePool({ create, destroy, maxSize: 2 });
    const r1 = await pool.acquire();
    const r2 = await pool.acquire();
    expect(r1).toBe(1);
    expect(r2).toBe(2);
    pool.release(r1);
    pool.release(r2);
    await pool.close();
  });

  it('queues waiters when at capacity', async () => {
    const { create, destroy } = makeCounter();
    const pool = new ResourcePool({ create, destroy, maxSize: 1, acquireTimeoutMs: 1000 });
    const r1 = await pool.acquire();

    let resolved = false;
    const p = pool.acquire().then((r) => {
      resolved = true;
      return r;
    });

    // Not yet resolved
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    pool.release(r1);
    const r2 = await p;
    expect(resolved).toBe(true);
    expect(r2).toBe(1); // handed the same resource
    pool.release(r2);
    await pool.close();
  });

  it('throws AcquireTimeoutError when timeout elapses', async () => {
    const { create, destroy } = makeCounter();
    const pool = new ResourcePool({ create, destroy, maxSize: 1, acquireTimeoutMs: 50 });
    const r1 = await pool.acquire();

    await expect(pool.acquire()).rejects.toThrow(AcquireTimeoutError);
    pool.release(r1);
    await pool.close();
  });

  it('validates resources on checkout', async () => {
    let id = 0;
    const destroy = vi.fn(async () => {});
    const validate = vi.fn(async (n: number) => n !== 1); // resource 1 is "unhealthy"
    const pool = new ResourcePool({
      create: async () => ++id,
      destroy,
      validate,
      maxSize: 2,
    });

    const r1 = await pool.acquire();
    expect(r1).toBe(1);
    pool.release(r1);

    // On next acquire, resource 1 should fail validation and be destroyed
    const r2 = await pool.acquire();
    expect(r2).toBe(2); // new resource created
    expect(destroy).toHaveBeenCalled();
    pool.release(r2);
    await pool.close();
  });

  it('use() acquires, runs fn, and releases', async () => {
    const { create, destroy } = makeCounter();
    const pool = new ResourcePool({ create, destroy, maxSize: 1 });

    const result = await pool.use(async (r) => r * 10);
    expect(result).toBe(10);

    const metrics = pool.getMetrics();
    expect(metrics.active).toBe(0);
    expect(metrics.idle).toBe(1);
    await pool.close();
  });

  it('use() destroys resource on error', async () => {
    const { create, destroy } = makeCounter();
    const pool = new ResourcePool({ create, destroy, maxSize: 1 });

    await expect(
      pool.use(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(destroy).toHaveBeenCalled();
    const metrics = pool.getMetrics();
    expect(metrics.active).toBe(0);
    expect(metrics.idle).toBe(0);
    await pool.close();
  });

  it('throws PoolClosedError after close', async () => {
    const { create, destroy } = makeCounter();
    const pool = new ResourcePool({ create, destroy, maxSize: 1 });
    await pool.close();
    expect(pool.isClosed()).toBe(true);
    await expect(pool.acquire()).rejects.toThrow(PoolClosedError);
  });

  it('close rejects pending waiters', async () => {
    const { create, destroy } = makeCounter();
    const pool = new ResourcePool({ create, destroy, maxSize: 1, acquireTimeoutMs: 5000 });
    const r1 = await pool.acquire();
    const p = pool.acquire();

    await pool.close();
    pool.release(r1);
    await expect(p).rejects.toThrow(PoolClosedError);
  });

  it('reports metrics correctly', async () => {
    const { create, destroy } = makeCounter();
    const pool = new ResourcePool({ create, destroy, maxSize: 3 });

    const r1 = await pool.acquire();
    const r2 = await pool.acquire();
    pool.release(r1);

    const metrics = pool.getMetrics();
    expect(metrics.active).toBe(1);
    expect(metrics.idle).toBe(1);
    expect(metrics.total).toBe(2);
    expect(metrics.waiters).toBe(0);

    pool.release(r2);
    await pool.close();
  });

  it('constructor rejects invalid maxSize', () => {
    const { create, destroy } = makeCounter();
    expect(() => new ResourcePool({ create, destroy, maxSize: 0 })).toThrow('maxSize');
    expect(() => new ResourcePool({ create, destroy, maxSize: -1 })).toThrow('maxSize');
  });

  it('constructor rejects minSize > maxSize', () => {
    const { create, destroy } = makeCounter();
    expect(
      () => new ResourcePool({ create, destroy, maxSize: 2, minSize: 5 }),
    ).toThrow('minSize must be <= maxSize');
  });

  it('destroy() removes resource from active count', async () => {
    const { create, destroy } = makeCounter();
    const pool = new ResourcePool({ create, destroy, maxSize: 2 });
    const r = await pool.acquire();
    await pool.destroy(r);
    const metrics = pool.getMetrics();
    expect(metrics.active).toBe(0);
    expect(metrics.total).toBe(0);
    await pool.close();
  });
});
