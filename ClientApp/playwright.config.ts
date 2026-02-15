import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  /* Configure projects for different roles */
  projects: [
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
