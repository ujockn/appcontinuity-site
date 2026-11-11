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
        mapping: resolve(dir, 'articles/mapping-supabase-auth-to-revenuecat/index.html'),
        refunds: resolve(dir, 'articles/refunds-transfers-and-which-webhook-updates-access/index.html'),
        sandbox: resolve(dir, 'articles/testing-subscriptions-in-sandbox-and-play-internal/index.html'),
        about: resolve(dir, 'about/index.html'),
        privacy: resolve(dir, 'privacy/index.html'),
        checklist: resolve(dir, 'checklist/index.html'),
      },
    },
  },
});
