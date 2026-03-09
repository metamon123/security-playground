'use strict';

function parseCookieHeader(header = '') {
  if (!header) {
    return {};
  }

  return header
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const separator = entry.indexOf('=');
      if (separator === -1) {
        return acc;
      }

      const key = decodeURIComponent(entry.slice(0, separator).trim());
      const value = decodeURIComponent(entry.slice(separator + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function getCookie(req, name) {
  const cookies = parseCookieHeader(req.headers.cookie || '');
  return cookies[name];
}

module.exports = {
  getCookie,
  parseCookieHeader,
};
