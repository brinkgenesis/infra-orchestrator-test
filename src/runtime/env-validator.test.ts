import { describe, it, expect } from 'vitest';
import { validateEnv, requireEnv } from './env-validator';
import type { EnvRule } from './env-validator';

describe('validateEnv', () => {
  it('resolves present variables', () => {
    const rules: EnvRule[] = [{ name: 'PORT', required: true }];
    const result = validateEnv(rules, { PORT: '3000' });
    expect(result.valid).toBe(true);
    expect(result.resolved['PORT']).toBe('3000');
    expect(result.errors).toHaveLength(0);
  });

  it('reports missing required variables', () => {
    const rules: EnvRule[] = [{ name: 'SECRET', required: true }];
    const result = validateEnv(rules, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('SECRET');
  });

  it('applies default values for missing variables', () => {
    const rules: EnvRule[] = [{ name: 'HOST', required: true, default: 'localhost' }];
    const result = validateEnv(rules, {});
    expect(result.valid).toBe(true);
    expect(result.resolved['HOST']).toBe('localhost');
  });

  it('skips optional variables without defaults', () => {
    const rules: EnvRule[] = [{ name: 'OPTIONAL', required: false }];
    const result = validateEnv(rules, {});
    expect(result.valid).toBe(true);
    expect(result.resolved['OPTIONAL']).toBeUndefined();
  });

  it('validates pattern constraints', () => {
    const rules: EnvRule[] = [{ name: 'PORT', required: true, pattern: /^\d+$/ }];
    const result = validateEnv(rules, { PORT: 'abc' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('pattern');
  });

  it('passes pattern validation for matching values', () => {
    const rules: EnvRule[] = [{ name: 'PORT', required: true, pattern: /^\d+$/ }];
    const result = validateEnv(rules, { PORT: '8080' });
    expect(result.valid).toBe(true);
    expect(result.resolved['PORT']).toBe('8080');
  });

  it('treats empty string as missing', () => {
    const rules: EnvRule[] = [{ name: 'TOKEN', required: true }];
    const result = validateEnv(rules, { TOKEN: '' });
    expect(result.valid).toBe(false);
  });

  it('handles multiple rules with mixed results', () => {
    const rules: EnvRule[] = [
      { name: 'A', required: true },
      { name: 'B', required: true, default: 'fallback' },
      { name: 'C', required: false },
    ];
    const result = validateEnv(rules, { A: 'val' });
    expect(result.valid).toBe(true);
    expect(result.resolved['A']).toBe('val');
    expect(result.resolved['B']).toBe('fallback');
  });
});

describe('requireEnv', () => {
  it('returns resolved values on success', () => {
    const rules: EnvRule[] = [{ name: 'DB', required: true }];
    const resolved = requireEnv(rules, { DB: 'postgres://localhost' });
    expect(resolved['DB']).toBe('postgres://localhost');
  });

  it('throws on validation failure', () => {
    const rules: EnvRule[] = [{ name: 'MISSING', required: true }];
    expect(() => requireEnv(rules, {})).toThrow('Environment validation failed');
  });
});
