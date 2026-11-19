import { defineConfig } from 'vitest/config';

/** Smoke tests that run against a live server. Start the app first, then run `npm run test:e2e`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.e2e.ts'],
    testTimeout: 30_000,
  },
});
