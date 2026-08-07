/* eslint-disable @typescript-eslint/no-require-imports */
// Preload shim: substitutes the `server-only` package with a no-op so the
// Firebase Admin SDK can be imported from Node test/script processes that are
// not running inside a React Server Component environment.
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'server-only') {
    return {};
  }
  return originalRequire.apply(this, arguments);
};
