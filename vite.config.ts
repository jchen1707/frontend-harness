import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Vite + embedded Vitest config.
// PWA/service-worker support is wired here (see docs/architecture.md § Performance).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Disabled by default in the harness skeleton; enable per-project once you
      // have an offline/caching strategy (see docs/architecture.md § Service Workers).
      disable: true,
      manifest: {
        name: 'frontend-harness',
        short_name: 'fe-harness',
        theme_color: '#0f172a',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    globals: false,
    environment: './src/test/vitest-environment.ts',
    setupFiles: ['./vitest.setup.ts'],
    css: true,
    // E2E specs are run by Playwright, not Vitest. Layer A is not run by Vitest either:
    // it is generated in the `harness` repo, verified here by sha, and carries its own
    // suite written against `node:test` — the one runner it can rely on in a Python repo,
    // a pnpm repo and a vendored tree no package manager has visited. Collecting it here
    // fails with "No test suite found", because the registrations go to Node's runner
    // rather than Vitest's. `.prettierignore` and `eslint.config.js` already exclude the
    // same directory for the same underlying reason: nothing in it can be fixed from here.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', '.agents/vendor/**'],
  },
});
