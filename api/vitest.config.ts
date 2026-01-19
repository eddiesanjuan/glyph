import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Point to the tests directory at project root
    include: ['../tests/**/*.test.ts'],
    // Use native globals (describe, it, expect, etc.)
    globals: true,
    // Environment setup
    environment: 'node',
    // Timeout for tests (in ms)
    testTimeout: 30000,
  },
});
