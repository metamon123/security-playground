'use strict';

const { test, expect } = require('@playwright/test');
const { ATTACKER, COMPANIES, startWebSocketLab } = require('../labs/websocket-detection/app');
const {
  assertHostsResolvable,
  closeWebSocketLabServers,
} = require('./helpers/server-control');

let servers;

function logBrowserVersion(browser, testInfo) {
  const headless = Boolean(testInfo.project.use.headless);
  console.log(
    `[websocket-detection] project=${testInfo.project.name}, headless=${headless}, browserVersion=${browser.version()}`
  );
}

function workspaceUrl(company, path = '/') {
  return `http://${company.host}:${company.port}${path}`;
}

function attackerUrl(path = '/') {
  return `http://${ATTACKER.host}:${ATTACKER.port}${path}`;
}

async function waitForLatestProbeResult(logLocator) {
  await expect(logLocator).toContainText('probe=', { timeout: 30000 });
  const text = await logLocator.textContent();
  const lines = String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('probe='));

  return lines[lines.length - 1] || '';
}

async function detectTarget(page, targetUrl) {
  const log = page.locator('#log');
  await page.getByRole('button', { name: '로그 지우기' }).click();
  await page.locator('#target').selectOption({ value: targetUrl });

  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '탐지 실행' }).click();
  const probeLine = await waitForLatestProbeResult(log);
  return probeLine;
}

test.describe('websocket-detection lab', () => {
  test.beforeAll(async () => {
    await assertHostsResolvable([ATTACKER.host, ...COMPANIES.map((company) => company.host)]);
    servers = startWebSocketLab();
  });

  test.afterAll(async () => {
    await closeWebSocketLabServers(servers);
  });

  test(
    '로그인된 workspace 와 로그아웃된 workspace 의 probe 결과가 구분된다',
    async ({ page, browser }, testInfo) => {
      logBrowserVersion(browser, testInfo);

      const company1 = COMPANIES[0];
      const company2 = COMPANIES[1];
      const company3 = COMPANIES[2];

      await page.goto(workspaceUrl(company1, '/login'));
      await page.goto(workspaceUrl(company2, '/logout'));
      await page.goto(workspaceUrl(company3, '/login'));

      await page.goto(attackerUrl('/'));

      let company1Probe = await detectTarget(page, workspaceUrl(company1));
      let company2Probe = await detectTarget(page, workspaceUrl(company2));
      let company3Probe = await detectTarget(page, workspaceUrl(company3));

      expect(company1Probe).toContain('probe=');
      expect(company2Probe).toContain('probe=');
      expect(company3Probe).toContain('probe=');

      console.log(`[websocket-detection] company1(login) : "${company1Probe}"`);
      console.log(`[websocket-detection] company2(logout): "${company2Probe}"`);
      console.log(`[websocket-detection] company3(login) : "${company3Probe}"`);

      expect(company1Probe).not.toContain('probe=OPEN');
      expect(company2Probe).toContain('probe=OPEN');
      expect(company3Probe).not.toContain('probe=OPEN');
    }
  );

  test(
    'workspace 에 login 했다가 logout 했을 때, logout 전후의 probe 결과가 구분된다',
    async ({ page, browser }, testInfo) => {
      logBrowserVersion(browser, testInfo);

      const company1 = COMPANIES[0];

      // login & check
      await page.goto(workspaceUrl(company1, '/login'));
      console.log('[websocket-detection] company1 login done.');
      await page.goto(attackerUrl('/'));
      let company1Probe = await detectTarget(page, workspaceUrl(company1));
      expect(company1Probe).toContain('probe=');
      console.log(`[websocket-detection] company1: "${company1Probe}"`);
      expect(company1Probe).not.toContain('probe=OPEN');

      // logout & check
      await page.goto(workspaceUrl(company1, '/logout'));
      console.log('[websocket-detection] company1 logout done.');
      await page.goto(attackerUrl('/'));
      company1Probe = await detectTarget(page, workspaceUrl(company1));
      expect(company1Probe).toContain('probe=');
      console.log(`[websocket-detection] company1: "${company1Probe}"`);
      expect(company1Probe).toContain('probe=OPEN');
    }
  );

});
