import { defineConfig } from 'vitest/config';

// Unit / integration tests run in Node. End-to-end browser tests live under
// e2e/ and are driven by Playwright, so they are excluded here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'web/dist/**'],
  },
});
