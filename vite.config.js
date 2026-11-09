import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const dir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        main: resolve(dir, 'index.html'),
        articles: resolve(dir, 'articles/index.html'),
        paywall: resolve(dir, 'articles/why-a-stripe-subscriber-hits-a-paywall/index.html'),
      },
    },
  },
});
