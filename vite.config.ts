import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: {
    port: 5180,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Keep the two big engines in their own long-lived cacheable chunks.
        advancedChunks: {
          groups: [
            { name: 'phaser', test: /node_modules[\\/]phaser[\\/]/ },
            { name: 'tone', test: /node_modules[\\/](tone|standardized-audio-context|automation-events)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
