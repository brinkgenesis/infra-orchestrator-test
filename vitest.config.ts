import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    teardownTimeout: 5_000,
    isolate: true,
    reporters: ['default'],
    passWithNoTests: false,
    retry: 2,
    bail: 5,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'node_modules'],
    },
  },
});
