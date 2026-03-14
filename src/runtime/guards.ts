/**
 * Runtime assertion guards for defensive programming.
 * These complement TypeScript's compile-time checks with runtime validation
 * at system boundaries.
 */

export function assertDefined<T>(
  value: T | null | undefined,
  name: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${name} to be defined, got ${String(value)}`);
  }
}

export function assertNonEmpty(value: string, name: string): asserts value is string {
  if (value.length === 0) {
    throw new Error(`Expected ${name} to be non-empty`);
  }
}

export function assertPositive(value: number, name: string): void {
  if (value <= 0 || !Number.isFinite(value)) {
    throw new Error(`Expected ${name} to be a positive finite number, got ${value}`);
  }
}

export function assertInRange(value: number, min: number, max: number, name: string): void {
  if (value < min || value > max || !Number.isFinite(value)) {
    throw new Error(`Expected ${name} to be in range [${min}, ${max}], got ${value}`);
  }
}

export function exhaustive(_value: never, context: string): never {
  throw new Error(`Unhandled case in ${context}: ${String(_value)}`);
}
