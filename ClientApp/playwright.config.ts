import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  /* Output directory for test artifacts (screenshots, traces) */
  outputDir: './test-results',
  /* Configure projects for different roles */
  projects: [
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.ts/,
    },
    {
      name: 'manager',
      use: {
        storageState: './e2e/.auth/manager.json',
      },
    },
    {
      name: 'user',
      use: {
        storageState: './e2e/.auth/user.json',
      },
    },
  ],
});
