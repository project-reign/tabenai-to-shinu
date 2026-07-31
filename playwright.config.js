import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173/tabenai-to-shinu/',
    browserName: 'chromium',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://127.0.0.1:4173/tabenai-to-shinu/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
