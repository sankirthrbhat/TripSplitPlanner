import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    channel: 'chrome',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'node server/src/scripts/startE2EServer.js',
    url: 'http://localhost:5000/api/health',
    reuseExistingServer: false,
    timeout: 90000,
  },
});

