import { defineConfig } from 'vitest/config';

// Tests cover the engine only - parsing, detection, redaction and scoring.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
});
