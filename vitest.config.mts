import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['./test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Everything that ships: server code, domain logic, API clients, controllers, the proxy and the UI.
      include: ['lib/**/*.ts', 'app/**/*.{ts,tsx}', 'components/**/*.tsx', 'proxy.ts'],
      // Type-only files have no code to run.
      exclude: ['lib/clients/spotify/types.ts', 'lib/domain/models/insights.ts', 'lib/domain/models/metadata.ts'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
