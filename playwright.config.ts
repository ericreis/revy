import { defineConfig, devices } from '@playwright/test';

// End-to-end tests drive the real stack: the built revy CLI spawns a detached
// loopback server (with a fake `gh` on PATH), and a real browser renders the
// review. Each spec owns its own server, so a single worker keeps things simple.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'dot' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
