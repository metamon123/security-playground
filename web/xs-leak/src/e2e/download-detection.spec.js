'use strict';

const { test, expect } = require('@playwright/test');
const { HOSTS, PORTS, startDownloadLab } = require('../labs/download-detection/app');
const {
  assertHostsResolvable,
  closeDownloadLabServers,
} = require('./helpers/server-control');

let servers;

function logBrowserVersion(browser, testInfo) {
  const headless = Boolean(testInfo.project.use.headless);
  console.log(
    `[download-detection] project=${testInfo.project.name}, headless=${headless}, browserVersion=${browser.version()}`
  );
}

function bannedUrl(path = '/') {
  return `http://${HOSTS.banned}:${PORTS.banned}${path}`;
}

function attackerUrl(path = '/', options = {}) {
  const base = `http://${HOSTS.attacker}:${PORTS.attacker}${path}`;
  if (!options.stealthier) {
    return base;
  }
  const delimiter = path.includes('?') ? '&' : '?';
  return `${base}${delimiter}stealthier=1`;
}

async function runProbe(page) {
  const log = page.locator('#log');
  await page.getByRole('button', { name: '로그 지우기' }).click();
  await page.getByRole('button', { name: '탐지 실행' }).click();

  await expect(log).toContainText('result:', { timeout: 15000 });
  const text = await log.textContent();
  const lines = String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('result:'));

  return lines[lines.length - 1] || '';
}

async function collectProbeResults(browser, targetUrl) {
  const visitedContext = await browser.newContext();
  const visitedPage = await visitedContext.newPage();

  await visitedContext.request.get(bannedUrl('/'));
  await visitedPage.goto(targetUrl);
  const visitedResult = await runProbe(visitedPage);
  await visitedContext.close();

  const notVisitedContext = await browser.newContext();
  const notVisitedPage = await notVisitedContext.newPage();

  await notVisitedPage.goto(targetUrl);
  const notVisitedResult = await runProbe(notVisitedPage);
  await notVisitedContext.close();

  return { visitedResult, notVisitedResult };
}

test.describe('download-detection lab', () => {
  test.beforeAll(async () => {
    await assertHostsResolvable([HOSTS.banned, HOSTS.attacker]);
    servers = startDownloadLab();
  });

  test.afterAll(async () => {
    await closeDownloadLabServers(servers);
  });

  test('기본(performance entry) 버전에서 방문 쿠키 신호를 수집한다', async ({ browser }, testInfo) => {
    logBrowserVersion(browser, testInfo);

    const { visitedResult, notVisitedResult } = await collectProbeResults(browser, attackerUrl('/'));

    expect(visitedResult).toContain('result:');
    expect(notVisitedResult).toContain('result:');

    console.log('[download-detection][classic] visited-group    :', visitedResult);
    console.log('[download-detection][classic] not-visited-group:', notVisitedResult);

    expect(visitedResult).toContain('다운로드 미발생');
    expect(notVisitedResult).toContain('다운로드 발생');
    expect(visitedResult).not.toBe(notVisitedResult);
  });

  test('stealthier(이중 iframe) 버전에서 방문 쿠키 신호를 수집한다', async ({ browser }, testInfo) => {
    logBrowserVersion(browser, testInfo);

    const { visitedResult, notVisitedResult } = await collectProbeResults(
      browser,
      attackerUrl('/', { stealthier: true })
    );

    expect(visitedResult).toContain('result:');
    expect(notVisitedResult).toContain('result:');

    console.log('[download-detection][stealthier] visited-group    :', visitedResult);
    console.log('[download-detection][stealthier] not-visited-group:', notVisitedResult);

    expect(visitedResult).toContain('다운로드 시도 미감지');
    expect(notVisitedResult).toContain('다운로드 시도 감지');
    expect(visitedResult).not.toBe(notVisitedResult);
  });
});
