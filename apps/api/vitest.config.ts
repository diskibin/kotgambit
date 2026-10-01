import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// esbuild (Vitest default) does not emit decorator metadata, which Nest DI relies on.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: { include: ['src/**/*.spec.ts'] },
});
