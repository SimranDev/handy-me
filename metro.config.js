const { getDefaultConfig } = require("expo/metro-config");

const { createAtDevProxy } = require("./scripts/at-dev-proxy");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Dev server only: proxy /at-proxy/* to the AT API with AT_API_KEY from .env,
// so dev builds and web can run without a key saved in Settings. The key stays
// in this Node process and never reaches the bundle (see CLAUDE.md).
const atDevProxy = createAtDevProxy();
const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = enhanceMiddleware
    ? enhanceMiddleware(middleware, server)
    : middleware;
  return (req, res, fallthrough) => {
    if (!atDevProxy(req, res)) next(req, res, fallthrough);
  };
};

module.exports = config;
