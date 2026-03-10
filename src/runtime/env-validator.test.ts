import { describe, it, expect } from 'vitest';
import { validateEnv, requireEnv, type EnvRule } from './env-validator';

const testEnv: Record<string, string | undefined> = {
  PORT: '3000',
  HOST: 'localhost',
  API_KEY: 'sk-abc123',
  EMPTY_VAR: '',
};

describe('validateEnv', () => {
  it('resolves present required variables', () => {
    const rules: EnvRule[] = [
      { name: 'PORT', required: true },
      { name: 'HOST', required: true },
    ];
    const result = validateEnv(rules, testEnv);
    expect(result.valid).toBe(true);
    expect(result.resolved).toEqual({ PORT: '3000', HOST: 'localhost' });
    expect(result.errors).toHaveLength(0);
  });

  it('reports missing required variables', () => {
    const rules: EnvRule[] = [
      { name: 'MISSING_VAR', required: true },
    ];
    const result = validateEnv(rules, testEnv);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required environment variable: MISSING_VAR');
  });

  it('treats empty string as missing', () => {
    const rules: EnvRule[] = [
      { name: 'EMPTY_VAR', required: true },
    ];
    const result = validateEnv(rules, testEnv);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('EMPTY_VAR');
  });

  it('applies default values for missing variables', () => {
    const rules: EnvRule[] = [
      { name: 'MISSING_VAR', required: false, default: 'fallback' },
    ];
    const result = validateEnv(rules, testEnv);
    expect(result.valid).toBe(true);
    expect(result.resolved['MISSING_VAR']).toBe('fallback');
  });

  it('applies default values for required variables when default is provided', () => {
    const rules: EnvRule[] = [
      { name: 'MISSING_VAR', required: true, default: '8080' },
    ];
    const result = validateEnv(rules, testEnv);
    expect(result.valid).toBe(true);
    expect(result.resolved['MISSING_VAR']).toBe('8080');
  });

  it('validates pattern matching', () => {
    const rules: EnvRule[] = [
      { name: 'PORT', required: true, pattern: /^\d+$/ },
    ];
    const result = validateEnv(rules, testEnv);
    expect(result.valid).toBe(true);
  });

  it('rejects values that fail pattern matching', () => {
    const rules: EnvRule[] = [
      { name: 'HOST', required: true, pattern: /^\d+$/ },
    ];
    const result = validateEnv(rules, testEnv);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('does not match expected pattern');
  });

  it('skips optional variables without defaults', () => {
    const rules: EnvRule[] = [
      { name: 'NONEXISTENT', required: false },
    ];
    const result = validateEnv(rules, testEnv);
    expect(result.valid).toBe(true);
    expect(result.resolved).toEqual({});
  });

  it('collects multiple errors', () => {
    const rules: EnvRule[] = [
      { name: 'MISSING_A', required: true },
      { name: 'MISSING_B', required: true },
    ];
    const result = validateEnv(rules, testEnv);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

describe('requireEnv', () => {
  it('returns resolved values on success', () => {
    const rules: EnvRule[] = [
      { name: 'PORT', required: true },
    ];
    const resolved = requireEnv(rules, testEnv);
    expect(resolved['PORT']).toBe('3000');
  });

  it('throws on validation failure', () => {
    const rules: EnvRule[] = [
      { name: 'MISSING', required: true },
    ];
    expect(() => requireEnv(rules, testEnv)).toThrow('Environment validation failed');
  });
});
