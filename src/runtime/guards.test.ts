import { describe, it, expect } from 'vitest';
import { assertDefined, assertNonEmpty, assertPositive, assertInRange, exhaustive } from './guards';

describe('assertDefined', () => {
  it('passes for defined values', () => {
    expect(() => assertDefined('hello', 'val')).not.toThrow();
    expect(() => assertDefined(0, 'val')).not.toThrow();
    expect(() => assertDefined(false, 'val')).not.toThrow();
  });

  it('throws for null', () => {
    expect(() => assertDefined(null, 'myVar')).toThrow('Expected myVar to be defined, got null');
  });

  it('throws for undefined', () => {
    expect(() => assertDefined(undefined, 'myVar')).toThrow('Expected myVar to be defined, got undefined');
  });
});

describe('assertNonEmpty', () => {
  it('passes for non-empty strings', () => {
    expect(() => assertNonEmpty('hello', 'val')).not.toThrow();
  });

  it('throws for empty string', () => {
    expect(() => assertNonEmpty('', 'name')).toThrow('Expected name to be non-empty');
  });
});

describe('assertPositive', () => {
  it('passes for positive numbers', () => {
    expect(() => assertPositive(1, 'val')).not.toThrow();
    expect(() => assertPositive(0.001, 'val')).not.toThrow();
  });

  it('throws for zero', () => {
    expect(() => assertPositive(0, 'val')).toThrow('positive finite number');
  });

  it('throws for negative numbers', () => {
    expect(() => assertPositive(-5, 'val')).toThrow('positive finite number');
  });

  it('throws for non-finite numbers', () => {
    expect(() => assertPositive(Infinity, 'val')).toThrow('positive finite number');
    expect(() => assertPositive(NaN, 'val')).toThrow('positive finite number');
  });
});

describe('assertInRange', () => {
  it('passes for values in range', () => {
    expect(() => assertInRange(5, 1, 10, 'val')).not.toThrow();
    expect(() => assertInRange(1, 1, 10, 'val')).not.toThrow();
    expect(() => assertInRange(10, 1, 10, 'val')).not.toThrow();
  });

  it('throws for values below range', () => {
    expect(() => assertInRange(0, 1, 10, 'val')).toThrow('in range [1, 10]');
  });

  it('throws for values above range', () => {
    expect(() => assertInRange(11, 1, 10, 'val')).toThrow('in range [1, 10]');
  });

  it('throws for non-finite values', () => {
    expect(() => assertInRange(NaN, 1, 10, 'val')).toThrow('in range');
  });
});

describe('exhaustive', () => {
  it('throws for unhandled cases', () => {
    const value = 'unexpected' as never;
    expect(() => exhaustive(value, 'switch')).toThrow('Unhandled case in switch');
  });
});
