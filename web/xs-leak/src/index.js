'use strict';

const mode = process.argv[2] || 'all';

function printUsageAndExit() {
  console.error('Usage: node index.js [all|download|websocket]');
  process.exit(1);
}

if (!['all', 'download', 'websocket'].includes(mode)) {
  printUsageAndExit();
}

if (mode === 'all' || mode === 'download') {
  const { startDownloadLab } = require('./labs/download-detection/app');
  startDownloadLab();
}

if (mode === 'all' || mode === 'websocket') {
  try {
    const { startWebSocketLab } = require('./labs/websocket-detection/app');
    startWebSocketLab();
  } catch (error) {
    if (
      error &&
      error.code === 'MODULE_NOT_FOUND' &&
      (error.message.includes("'ws'") || error.message.includes("'express'"))
    ) {
      console.error("Missing dependency. Run: npm install");
      process.exit(1);
    }
    throw error;
  }
}

console.log(`[xs-leak-labs] mode=${mode}`);
