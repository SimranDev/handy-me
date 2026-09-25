/**
 * Dev-only proxy to the Auckland Transport API, mounted on the Metro dev
 * server by metro.config.js. It adds the developer's key from AT_API_KEY in
 * .env (no EXPO_PUBLIC_ prefix, so it is never inlined into the JS bundle)
 * as the Ocp-Apim-Subscription-Key header.
 *
 * The app uses it in __DEV__ only, when no key is saved in Settings (see
 * src/features/train-tracker/api/dev-proxy.ts). Production builds have no
 * dev server, so there is no proxy. The key is never logged or sent back.
 *
 *   GET /at-proxy/status             → { "available": true | false }
 *   GET /at-proxy/gtfs/v3/…           → https://api.at.govt.nz/gtfs/v3/…
 *   GET /at-proxy/realtime/…          → https://api.at.govt.nz/realtime/…
 */
const PREFIX = "/at-proxy";
const AT_ORIGIN = "https://api.at.govt.nz";
const TIMEOUT_MS = 15_000;
/** Response headers worth passing on; the body arrives already decompressed. */
const PASS_HEADERS = ["content-type", "retry-after"];

/**
 * The AT URL for a proxied request path, or null if it isn't one we forward:
 * only GTFS and realtime paths on AT's own host, with no "..".
 */
function upstreamUrl(requestUrl) {
  if (typeof requestUrl !== "string" || !requestUrl.startsWith(`${PREFIX}/`)) {
    return null;
  }
  const rest = requestUrl.slice(PREFIX.length);
  const path = rest.split("?")[0];
  if (!/^\/(gtfs|realtime)\//.test(path) || /(^|\/)\.\.?(\/|$)/.test(path)) {
    return null;
  }
  try {
    const url = new URL(rest, AT_ORIGIN);
    return url.origin === AT_ORIGIN ? url.toString() : null;
  } catch {
    return null;
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/**
 * Connect-style handler. Returns false for requests it doesn't own, so the
 * caller can pass them on.
 */
function createAtDevProxy({
  getKey = () => process.env.AT_API_KEY?.trim() || null,
  fetchImpl = fetch,
} = {}) {
  return function handle(req, res) {
    if (!req.url?.startsWith(`${PREFIX}/`)) return false;

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Only GET is proxied." });
      return true;
    }
    const key = getKey();
    if (req.url.split("?")[0] === `${PREFIX}/status`) {
      sendJson(res, 200, { available: key != null });
      return true;
    }
    const target = upstreamUrl(req.url);
    if (!target) {
      sendJson(res, 404, { error: "Not a proxied AT path." });
      return true;
    }
    if (!key) {
      sendJson(res, 503, { error: "AT_API_KEY is not set in .env." });
      return true;
    }

    fetchImpl(target, {
      headers: { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
      .then(async (upstream) => {
        const body = Buffer.from(await upstream.arrayBuffer());
        res.statusCode = upstream.status;
        for (const name of PASS_HEADERS) {
          const value = upstream.headers.get(name);
          if (value) res.setHeader(name, value);
        }
        res.setHeader("Cache-Control", "no-store");
        res.end(body);
      })
      .catch(() => {
        if (!res.headersSent) {
          sendJson(res, 502, { error: "Couldn't reach Auckland Transport." });
        } else {
          res.end();
        }
      });
    return true;
  };
}

module.exports = { PREFIX, createAtDevProxy, upstreamUrl };
