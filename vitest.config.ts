import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    retry: 0,
    passWithNoTests: false,
    restoreMocks: true,
    pool: 'forks',
    isolate: true,
    reporters: ['default'],
    bail: 5,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
  },
});
