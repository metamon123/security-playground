'use strict';

const fs = require('fs');
const path = require('path');

const templateCache = new Map();

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loadTemplate(templatePath) {
  const resolvedPath = path.resolve(templatePath);
  if (!templateCache.has(resolvedPath)) {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    templateCache.set(resolvedPath, content);
  }
  return templateCache.get(resolvedPath);
}

function renderTemplate(templatePath, values = {}) {
  let html = loadTemplate(templatePath);
  for (const [key, value] of Object.entries(values)) {
    const token = `__${key}__`;
    html = html.split(token).join(String(value));
  }
  return html;
}

module.exports = {
  escapeHtml,
  renderTemplate,
};
