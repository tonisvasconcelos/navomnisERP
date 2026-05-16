const path = require('node:path');
const { defineConfig, devices } = require('@playwright/test');

/** Staging / preview externo: definir `PLAYWRIGHT_BASE_URL` (ex. `https://staging.example.com`) e `VITE_API_URL` no build do front já deployado. Sem webServer local. */
const stagingBase = process.env.PLAYWRIGHT_BASE_URL?.trim();
const localBase = 'http://127.0.0.1:4173';

module.exports = defineConfig({
  testDir: path.join(__dirname, 'e2e'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ]
    : [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: stagingBase || localBase,
    trace: 'on-first-retry',
  },
  webServer: stagingBase
    ? undefined
    : {
        command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
        cwd: __dirname,
        url: localBase,
        reuseExistingServer: !process.env.CI,
      },
});
