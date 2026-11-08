import { defineConfig, devices } from '@playwright/test';

const liveBaseURL = process.env.PLAYWRIGHT_BASE_URL;
if (liveBaseURL && process.env.PLAYWRIGHT_ALLOW_LIVE !== '1') {
  throw new Error('Set PLAYWRIGHT_ALLOW_LIVE=1 to authorize disposable test data on a live service.');
}
const channel = process.env.PLAYWRIGHT_CHANNEL || 'chrome';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: liveBaseURL ? 180000 : 60000,
  expect: { timeout: liveBaseURL ? 30000 : 5000 },
  use: {
    baseURL: liveBaseURL || 'http://localhost:5000',
    // Live traces can capture cookies and invitation tokens; keep them disabled.
    trace: liveBaseURL ? 'off' : 'retain-on-failure',
    channel,
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], channel },
    },
  ],
  webServer: liveBaseURL ? undefined : {
    command: 'node server/src/scripts/startE2EServer.js',
    url: 'http://localhost:5000/api/health',
    reuseExistingServer: false,
    timeout: 90000,
  },
});

