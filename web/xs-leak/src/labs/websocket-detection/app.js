'use strict';

const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const { parseCookieHeader } = require('../../lib/cookie-utils');
const { escapeHtml, renderTemplate } = require('../../lib/template-utils');

const COMPANIES = [
  { name: 'company1', host: 'company1.toy-slack.com', port: 9001 },
  { name: 'company2', host: 'company2.toy-slack.com', port: 9002 },
  { name: 'company3', host: 'company3.toy-slack.com', port: 9003 },
];

const ATTACKER = {
  host: 'attacker.toy-slack.com',
  port: 9004,
};

const TEMPLATE_DIR = path.join(__dirname, 'templates');

function template(fileName, values) {
  return renderTemplate(path.join(TEMPLATE_DIR, fileName), values);
}

function applyNoStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

function cookieName(companyName) {
  return `${companyName}_session`;
}

function isLoggedInFromCookieHeader(cookieHeader, companyName) {
  const cookies = parseCookieHeader(cookieHeader || '');
  return cookies[cookieName(companyName)] === '1';
}

function isLoggedInRequest(req, companyName) {
  return isLoggedInFromCookieHeader(req.headers.cookie, companyName);
}

function getUpgradePath(req) {
  try {
    const host = req.headers.host || 'localhost';
    return new URL(req.url, `http://${host}`).pathname;
  } catch (error) {
    return '';
  }
}

function createCompanyServer(company) {
  const app = express();
  app.use(applyNoStore);

  app.get('/login', (req, res) => {
    res.set('Set-Cookie', `${cookieName(company.name)}=1; Path=/; HttpOnly; SameSite=Lax`);
    res.redirect('/');
  });

  app.get('/logout', (req, res) => {
    res.set('Set-Cookie', `${cookieName(company.name)}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
    res.redirect('/');
  });

  app.get('/', (req, res) => {
    const loggedIn = isLoggedInRequest(req, company.name);
    const stateClass = loggedIn ? 'ok' : 'warn';
    const stateLabel = loggedIn
      ? '로그인 상태 (페이지 로드시 WebSocket 생성)'
      : '로그아웃 상태 (WebSocket 미생성)';

    res
      .status(200)
      .type('html')
      .send(
        template('workspace.html', {
          COMPANY_NAME: escapeHtml(company.name),
          SHOULD_CONNECT: loggedIn ? 'true' : 'false',
          STATE_CLASS: stateClass,
          STATE_LABEL: escapeHtml(stateLabel),
        })
      );
  });

  app.use((req, res) => {
    res.status(404).type('text/plain').send('Not Found');
  });

  const server = app.listen(company.port, () => {
    console.log(`[ws-lab] ${company.name}: http://${company.host}:${company.port}`);
  });

  const companyWss = new WebSocketServer({ noServer: true });

  companyWss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'ready', ts: Date.now() }));

    const interval = setInterval(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
      }
    }, 5000);

    ws.on('close', () => {
      clearInterval(interval);
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const pathname = getUpgradePath(req);
    if (pathname !== '/workspace-ws') {
      socket.destroy();
      return;
    }

    if (!isLoggedInFromCookieHeader(req.headers.cookie, company.name)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    companyWss.handleUpgrade(req, socket, head, (ws) => {
      companyWss.emit('connection', ws, req);
    });
  });

  return server;
}

function createAttackerServer() {
  const app = express();
  app.use(applyNoStore);

  app.get('/', (req, res) => {
    const options = COMPANIES.map((company) => {
      const targetUrl = `http://${company.host}:${company.port}/`;
      return `<option value="${escapeHtml(targetUrl)}">${escapeHtml(company.name)} (${escapeHtml(targetUrl)})</option>`;
    }).join('');

    res
      .status(200)
      .type('html')
      .send(
        template('attacker.html', {
          TARGET_OPTIONS: options,
        })
      );
  });

  app.use((req, res) => {
    res.status(404).type('text/plain').send('Not Found');
  });

  const server = app.listen(ATTACKER.port, () => {
    console.log(`[ws-lab] attacker: http://${ATTACKER.host}:${ATTACKER.port}`);
  });

  const attackWss = new WebSocketServer({ noServer: true });

  attackWss.on('connection', () => {
    // Open and idle: used to occupy WebSocket connection slots.
  });

  server.on('upgrade', (req, socket, head) => {
    const pathname = getUpgradePath(req);
    if (pathname !== '/attack-ws') {
      socket.destroy();
      return;
    }

    attackWss.handleUpgrade(req, socket, head, (ws) => {
      attackWss.emit('connection', ws, req);
    });
  });

  return server;
}

function startWebSocketLab() {
  const companyServers = COMPANIES.map((company) => createCompanyServer(company));
  const attackerServer = createAttackerServer();

  return {
    attackerServer,
    companyServers,
  };
}

module.exports = {
  ATTACKER,
  COMPANIES,
  startWebSocketLab,
};
