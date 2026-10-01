import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// esbuild (Vitest default) does not emit decorator metadata, which Nest DI relies on.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts'],
    // Starts Postgres in Docker and exports its DATABASE_URL to the workers
    globalSetup: ['./test/global-setup.ts'],
    // Real hashing and a database make single tests slower than the default allows
    testTimeout: 20_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Throwaway value for tests, real ones come from the environment
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123',
    },
  },
});
