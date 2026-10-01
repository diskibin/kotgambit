import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// esbuild (Vitest default) does not emit decorator metadata, which Nest DI relies on.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Throwaway values for tests, real ones come from the environment
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123',
      DATABASE_URL: 'postgresql://kotgambit:kotgambit@localhost:5432/kotgambit',
    },
  },
});
