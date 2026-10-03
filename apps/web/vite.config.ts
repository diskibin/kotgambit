import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    // The long screens are drawn with many board squares, and the files run side by side: 5 s is too tight
    testTimeout: 20_000,
    setupFiles: ['./src/test-setup.ts'],
  },
});
