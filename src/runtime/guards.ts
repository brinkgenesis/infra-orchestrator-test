/**
 * Runtime assertion guards for defensive programming.
 * These complement TypeScript's compile-time checks with runtime validation
 * at system boundaries.
 */

/** Asserts that a value is neither null nor undefined, throwing if it is. */
export function assertDefined<T>(
  value: T | null | undefined,
  name: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${name} to be defined, got ${String(value)}`);
  }
}

/** Asserts that a value is a non-empty string, throwing a descriptive error otherwise. */
export function assertNonEmpty(value: unknown, name: string): asserts value is string {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${name} to be a non-empty string, got ${String(value)}`);
  }
  if (typeof value !== 'string') {
    throw new Error(`Expected ${name} to be a string, got ${typeof value}`);
  }
  if (value.length === 0) {
    throw new Error(`Expected ${name} to be non-empty`);
  }
}

/** Asserts that a number is positive and finite, throwing if it is not. */
export function assertPositive(value: number, name: string): void {
  if (value <= 0 || !Number.isFinite(value)) {
    throw new Error(`Expected ${name} to be a positive finite number, got ${value}`);
  }
}

/** Asserts that a number is within [min, max] inclusive, throwing if it is out of range. */
export function assertInRange(value: number, min: number, max: number, name: string): void {
  if (value < min || value > max || !Number.isFinite(value)) {
    throw new Error(`Expected ${name} to be in range [${min}, ${max}], got ${value}`);
  }
}

/** Exhaustive check helper that throws at runtime if an unhandled discriminant is reached. */
export function exhaustive(_value: never, context: string): never {
  throw new Error(`Unhandled case in ${context}: ${String(_value)}`);
}
