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
      // Server code, domain logic, API clients, controllers and pure UI logic.
      // React components are covered by the build and manual testing.
      include: [
        'lib/**/*.ts',
        'app/api/**/*.ts',
        'proxy.ts',
        'app/**/_components/**/*.ts',
      ],
      exclude: ['**/*.test.ts', 'lib/hooks/**', 'lib/clients/spotify/types.ts', 'lib/domain/models/insights.ts', 'lib/domain/models/metadata.ts'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
