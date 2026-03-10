'use strict';

const { defineConfig } = require('@playwright/test');

function isProjectRequested(projectName) {
  for (let i = 0; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === '--project') {
      const next = process.argv[i + 1] || '';
      const selected = next.split(',').map((value) => value.trim());
      if (selected.includes(projectName)) {
        return true;
      }
    }
    if (arg.startsWith('--project=')) {
      const raw = arg.slice('--project='.length);
      const selected = raw.split(',').map((value) => value.trim());
      if (selected.includes(projectName)) {
        return true;
      }
    }
  }
  return false;
}

const includeWebsocketChrome = isProjectRequested('websocket-chrome');

const projects = [
  {
    name: 'download-firefox',
    testMatch: '**/download-detection.spec.js',
    use: {
      browserName: 'firefox',
    },
  },
  {
    name: 'download-chrome',
    testMatch: '**/download-detection.spec.js',
    use: {
      browserName: 'chromium',
    },
  },
  {
    name: 'download-safari',
    testMatch: '**/download-detection.spec.js',
    use: {
      browserName: 'webkit',
    },
  },
  {
    name: 'websocket-firefox',
    testMatch: '**/websocket-detection.spec.js',
    use: {
      browserName: 'firefox',
    },
  },
  {
    name: 'websocket-safari',
    testMatch: '**/websocket-detection.spec.js',
    use: {
      browserName: 'webkit',
    },
  },
];

if (includeWebsocketChrome) {
  projects.push({
    name: 'websocket-chrome',
    testMatch: '**/websocket-detection.spec.js',
    use: {
      browserName: 'chromium',
    },
  });
}

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
  projects,
});
