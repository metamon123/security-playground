'use strict';

const dns = require('dns').promises;

function closeServer(server) {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }

    try {
      server.close(() => resolve());
    } catch (error) {
      resolve();
    }
  });
}

async function closeDownloadLabServers(servers) {
  if (!servers) {
    return;
  }

  await Promise.all([
    closeServer(servers.bannedServer),
    closeServer(servers.attackerServer),
  ]);
}

async function closeWebSocketLabServers(servers) {
  if (!servers) {
    return;
  }

  const allServers = [servers.attackerServer, ...(servers.companyServers || [])];
  await Promise.all(allServers.map((server) => closeServer(server)));
}

async function assertHostsResolvable(hosts) {
  const failed = [];

  for (const host of hosts) {
    try {
      await dns.lookup(host);
    } catch (error) {
      failed.push(host);
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `다음 호스트를 해석할 수 없습니다: ${failed.join(', ')}. /etc/hosts 설정을 확인하세요.`
    );
  }
}

module.exports = {
  assertHostsResolvable,
  closeDownloadLabServers,
  closeWebSocketLabServers,
};
