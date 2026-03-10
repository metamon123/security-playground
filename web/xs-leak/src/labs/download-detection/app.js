'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const HOSTS = {
  banned: 'banned.download-lab.test',
  attacker: 'attacker.download-lab.test',
};

const PORTS = {
  banned: 9100,
  attacker: 9101,
};

const TEMPLATE_DIR = path.join(__dirname, 'templates');
const VISIT_COOKIE = 'banned_manual_visited';
const MANUAL_FILENAME = '위험한-메뉴얼.pdf';
const MANUAL_FILENAME_ENCODED = encodeURIComponent(MANUAL_FILENAME);

function renderTemplate(fileName, values = {}) {
  const templatePath = path.join(TEMPLATE_DIR, fileName);
  let html = fs.readFileSync(templatePath, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    html = html.split(`__${key}__`).join(String(value));
  }
  return html;
}

function hasVisitedCookie(req) {
  return req.cookies[VISIT_COOKIE] === '1';
}

function applyNoStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

function buildManualPdf(nonce) {
  return Buffer.from(
    `%PDF-1.4\n` +
      `1 0 obj<< /Type /Catalog /Pages 2 0 R>>endobj\n` +
      `2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1>>endobj\n` +
      `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 420] /Contents 4 0 R /Resources << /Font << /F1 5 0 R>>>>>>endobj\n` +
      `4 0 obj<< /Length 96>>stream\n` +
      `BT /F1 16 Tf 40 350 Td (Dangerous Manual - educational lab) Tj 0 -30 Td (nonce: ${nonce}) Tj ET\n` +
      `endstream endobj\n` +
      `5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica>>endobj\n` +
      `xref\n0 6\n0000000000 65535 f \n` +
      `trailer<< /Size 6 /Root 1 0 R>>\nstartxref\n0\n%%EOF\n`,
    'utf8'
  );
}

function sendManualDownload(res, nonce) {
  const body = buildManualPdf(nonce);
  res
    .status(200)
    .set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dangerous-manual.pdf"; filename*=UTF-8''${MANUAL_FILENAME_ENCODED}`,
      'X-Content-Type-Options': 'nosniff',
    })
    .send(body);
}

function startDownloadLab() {
  const bannedApp = express();
  bannedApp.use(cookieParser());
  bannedApp.use(applyNoStore);

  bannedApp.get('/', (req, res) => {
    const visited = hasVisitedCookie(req);

    if (!visited) {
      const nonce = String(req.query.nonce || 'from-root-first-visit');
      res.cookie(VISIT_COOKIE, '1', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      });
      sendManualDownload(res, nonce);
      return;
    }

    res
      .status(200)
      .type('html')
      .send(
        renderTemplate('banned-service.html', {
          ATTACKER_URL: `http://${HOSTS.attacker}:${PORTS.attacker}`,
          MAIN_MESSAGE: '이미 메뉴얼을 알고 계시죠?',
          DETAIL_MESSAGE: '방문 쿠키가 있어 파일은 더 이상 내려주지 않습니다.',
        })
      );
  });

  bannedApp.use((req, res) => {
    res.status(404).type('text/plain').send('Not Found');
  });

  const attackerApp = express();
  attackerApp.use(cookieParser());
  attackerApp.use(applyNoStore);

  attackerApp.get('/', (req, res) => {
    const targetBase = `http://${HOSTS.banned}:${PORTS.banned}/`;
    const attackerBase = `http://${HOSTS.attacker}:${PORTS.attacker}/`;
    const useStealthier = String(req.query.stealthier || '') === '1';
    const fileName = useStealthier ? 'attacker-stealthier.html' : 'attacker.html';

    res
      .status(200)
      .type('html')
      .send(
        renderTemplate(fileName, {
          TARGET_BASE_TEXT: targetBase,
          TARGET_BASE_JSON: JSON.stringify(targetBase),
          ATTACKER_CLASSIC_URL: attackerBase,
          ATTACKER_STEALTH_URL: `${attackerBase}?stealthier=1`,
        })
      );
  });

  attackerApp.use((req, res) => {
    res.status(404).type('text/plain').send('Not Found');
  });

  const bannedServer = bannedApp.listen(PORTS.banned, () => {
    console.log(`[download-lab] Banned server:   http://${HOSTS.banned}:${PORTS.banned}`);
  });

  const attackerServer = attackerApp.listen(PORTS.attacker, () => {
    console.log(`[download-lab] Attacker server: http://${HOSTS.attacker}:${PORTS.attacker}`);
  });

  return {
    attackerServer,
    bannedServer,
  };
}

module.exports = {
  HOSTS,
  PORTS,
  startDownloadLab,
};
