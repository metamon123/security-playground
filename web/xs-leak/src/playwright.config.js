'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  use: {
    headless: process.env.PW_HEADED === '1' ? false : true,
    trace: 'on',
    screenshot: {
      mode: 'on',
      fullPage: true,
    },
    video: {
      mode: 'on',
      size: { width: 1920, height: 1080 },
    },
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
      },
    },
    {
      name: 'chrome',
      use: {
        browserName: 'chromium',
      },
    },
    {
      name: 'safari',
      use: {
        browserName: 'webkit',
      },
    },
  ],
});
