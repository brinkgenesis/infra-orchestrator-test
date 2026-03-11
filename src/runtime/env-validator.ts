export interface EnvRule {
  name: string;
  required: boolean;
  pattern?: RegExp;
  default?: string;
}

export interface EnvValidationResult {
  valid: boolean;
  resolved: Record<string, string>;
  errors: string[];
}

/**
 * Validates environment variables against a set of rules and returns
 * resolved values with defaults applied.
 */
export function validateEnv(
  rules: readonly EnvRule[],
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): EnvValidationResult {
  const errors: string[] = [];
  const resolved: Record<string, string> = {};

  for (const rule of rules) {
    const value = env[rule.name];

    if (value === undefined || value === '') {
      if (rule.required && rule.default === undefined) {
        errors.push(`Missing required environment variable: ${rule.name}`);
        continue;
      }
      if (rule.default !== undefined) {
        resolved[rule.name] = rule.default;
        continue;
      }
      // Not required and no default — skip
      continue;
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push(
        `Environment variable ${rule.name} does not match expected pattern: ${rule.pattern.source}`,
      );
      continue;
    }

    resolved[rule.name] = value;
  }

  return { valid: errors.length === 0, resolved, errors };
}

/**
 * Validates and throws if any required env vars are missing or invalid.
 */
export function requireEnv(
  rules: readonly EnvRule[],
  env?: Record<string, string | undefined>,
): Record<string, string> {
  const result = validateEnv(rules, env);
  if (!result.valid) {
    throw new Error(`Environment validation failed:\n${result.errors.join('\n')}`);
  }
  return result.resolved;
}
