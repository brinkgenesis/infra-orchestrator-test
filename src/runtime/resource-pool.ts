export interface ResourcePoolOptions<T> {
  /** Creates a new resource instance. */
  create: () => Promise<T>;
  /** Destroys a resource instance. */
  destroy: (resource: T) => Promise<void>;
  /** Optional health check — return true if the resource is still usable. */
  validate?: (resource: T) => Promise<boolean>;
  /** Minimum number of resources to keep in the pool. */
  minSize?: number;
  /** Maximum number of resources the pool can manage (active + idle). */
  maxSize: number;
  /** Time in ms before an idle resource is evicted. 0 = no eviction. */
  idleTimeoutMs?: number;
  /** Time in ms to wait for a resource before throwing. */
  acquireTimeoutMs?: number;
}

export interface PoolMetrics {
  /** Number of resources currently checked out. */
  active: number;
  /** Number of idle resources available for checkout. */
  idle: number;
  /** Total resources managed by the pool (active + idle). */
  total: number;
  /** Number of waiters blocked on acquire. */
  waiters: number;
}

interface PoolEntry<T> {
  resource: T;
  idleSince: number;
}

/** Error thrown when a resource cannot be acquired within the configured timeout. */
export class AcquireTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Failed to acquire resource within ${timeoutMs}ms`);
    this.name = 'AcquireTimeoutError';
  }
}

/** Error thrown when the pool has been closed and cannot serve requests. */
export class PoolClosedError extends Error {
  constructor() {
    super('Resource pool is closed');
    this.name = 'PoolClosedError';
  }
}

/**
 * Generic async resource pool with lifecycle management.
 * Supports min/max sizing, idle eviction, health validation on checkout,
 * and acquire timeouts. Useful for managing database connections,
 * HTTP clients, or any reusable resource.
 */
export class ResourcePool<T> {
  private readonly idle: PoolEntry<T>[] = [];
  private activeCount = 0;
  private readonly waiters: Array<{
    resolve: (resource: T) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout> | undefined;
  }> = [];
  private closed = false;
  private evictionTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  private readonly createFn: () => Promise<T>;
  private readonly destroyFn: (resource: T) => Promise<void>;
  private readonly validateFn: ((resource: T) => Promise<boolean>) | undefined;
  private readonly minSize: number;
  private readonly maxSize: number;
  private readonly idleTimeoutMs: number;
  private readonly acquireTimeoutMs: number;

  constructor(opts: ResourcePoolOptions<T>) {
    if (opts.maxSize < 1 || !Number.isFinite(opts.maxSize)) {
      throw new Error('maxSize must be a positive finite integer');
    }
    const minSize = opts.minSize ?? 0;
    if (minSize < 0 || !Number.isFinite(minSize)) {
      throw new Error('minSize must be a non-negative finite integer');
    }
    if (minSize > opts.maxSize) {
      throw new Error('minSize must be <= maxSize');
    }
    this.createFn = opts.create;
    this.destroyFn = opts.destroy;
    this.validateFn = opts.validate;
    this.minSize = minSize;
    this.maxSize = opts.maxSize;
    this.idleTimeoutMs = opts.idleTimeoutMs ?? 0;
    this.acquireTimeoutMs = opts.acquireTimeoutMs ?? 30000;

    if (this.idleTimeoutMs > 0) {
      this.startEvictionLoop();
    }
  }

  /** Returns a snapshot of the pool's current metrics. */
  getMetrics(): PoolMetrics {
    return {
      active: this.activeCount,
      idle: this.idle.length,
      total: this.activeCount + this.idle.length,
      waiters: this.waiters.length,
    };
  }

  /** Returns true if the pool has been closed. */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Acquires a resource from the pool. If an idle resource is available and
   * passes validation, it is returned. Otherwise a new resource is created
   * (if under maxSize) or the caller waits until one is released.
   */
  async acquire(): Promise<T> {
    if (this.closed) {
      throw new PoolClosedError();
    }

    // Try to get a valid idle resource
    while (this.idle.length > 0) {
      const entry = this.idle.pop()!;
      if (this.validateFn) {
        try {
          const valid = await this.validateFn(entry.resource);
          if (!valid) {
            await this.safeDestroy(entry.resource);
            continue;
          }
        } catch {
          await this.safeDestroy(entry.resource);
          continue;
        }
      }
      this.activeCount++;
      return entry.resource;
    }

    // Try to create a new resource if under capacity
    const total = this.activeCount + this.idle.length;
    if (total < this.maxSize) {
      this.activeCount++;
      try {
        return await this.createFn();
      } catch (err) {
        this.activeCount--;
        throw err;
      }
    }

    // At capacity — wait for a release
    return new Promise<T>((resolve, reject) => {
      const waiter: (typeof this.waiters)[number] = { resolve, reject, timer: undefined };

      if (this.acquireTimeoutMs > 0) {
        waiter.timer = setTimeout(() => {
          const idx = this.waiters.indexOf(waiter);
          if (idx !== -1) {
            this.waiters.splice(idx, 1);
          }
          reject(new AcquireTimeoutError(this.acquireTimeoutMs));
        }, this.acquireTimeoutMs);
      }

      this.waiters.push(waiter);
    });
  }

  /**
   * Returns a resource to the pool. If there are waiters, the resource is
   * handed directly to the next waiter. Otherwise it is placed in the idle list.
   */
  release(resource: T): void {
    if (this.closed) {
      this.activeCount--;
      void this.safeDestroy(resource);
      return;
    }

    // Hand off to a waiter if one exists
    const waiter = this.waiters.shift();
    if (waiter) {
      if (waiter.timer !== undefined) {
        clearTimeout(waiter.timer);
      }
      // activeCount stays the same — transferring from one holder to another
      waiter.resolve(resource);
      return;
    }

    this.activeCount--;
    this.idle.push({ resource, idleSince: Date.now() });
  }

  /**
   * Destroys a resource without returning it to the pool.
   * Use this when a resource is known to be broken.
   */
  async destroy(resource: T): Promise<void> {
    this.activeCount--;
    await this.safeDestroy(resource);
  }

  /**
   * Acquires a resource, runs the given function, and releases
   * (or destroys on error) the resource automatically.
   */
  async use<R>(fn: (resource: T) => Promise<R>): Promise<R> {
    const resource = await this.acquire();
    try {
      const result = await fn(resource);
      this.release(resource);
      return result;
    } catch (err) {
      await this.destroy(resource);
      throw err;
    }
  }

  /**
   * Closes the pool: rejects all waiters, destroys all idle resources,
   * and prevents further acquisitions. Active resources are destroyed
   * when released.
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    if (this.evictionTimer !== undefined) {
      clearTimeout(this.evictionTimer);
      this.evictionTimer = undefined;
    }

    // Reject all waiters
    for (const waiter of this.waiters.splice(0)) {
      if (waiter.timer !== undefined) {
        clearTimeout(waiter.timer);
      }
      waiter.reject(new PoolClosedError());
    }

    // Destroy all idle resources
    const destroyPromises = this.idle.splice(0).map((entry) =>
      this.safeDestroy(entry.resource),
    );
    await Promise.all(destroyPromises);
  }

  private async safeDestroy(resource: T): Promise<void> {
    try {
      await this.destroyFn(resource);
    } catch {
      // Swallow destroy errors
    }
  }

  private startEvictionLoop(): void {
    const interval = Math.max(1000, Math.floor(this.idleTimeoutMs / 2));
    this.evictionTimer = setTimeout(() => {
      void this.evict().then(() => {
        if (!this.closed) {
          this.startEvictionLoop();
        }
      });
    }, interval);
  }

  private async evict(): Promise<void> {
    const now = Date.now();
    const toDestroy: T[] = [];
    const remaining: PoolEntry<T>[] = [];

    for (const entry of this.idle) {
      const total = this.activeCount + remaining.length;
      if (now - entry.idleSince >= this.idleTimeoutMs && total >= this.minSize) {
        toDestroy.push(entry.resource);
      } else {
        remaining.push(entry);
      }
    }

    this.idle.length = 0;
    this.idle.push(...remaining);

    await Promise.all(toDestroy.map((r) => this.safeDestroy(r)));
  }
}
