import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * In development, the Metro dev server can proxy AT requests with a key from
 * AT_API_KEY in .env (see scripts/at-dev-proxy.js). The key stays on the dev
 * server: the app only learns whether the proxy has one. Used only when no
 * key is saved in Settings, and never in production builds.
 */
const PREFIX = "/at-proxy";

/** Base URL of the dev proxy, or null outside development. */
export function devProxyBaseUrl(): string | null {
  if (!__DEV__) return null;
  if (Platform.OS === "web") {
    return typeof window === "undefined"
      ? null
      : `${window.location.origin}${PREFIX}`;
  }
  // "192.168.1.5:8081": set by Expo CLI while developing.
  const host = Constants.expoConfig?.hostUri;
  return host ? `http://${host}${PREFIX}` : null;
}

let available: Promise<boolean> | null = null;

/**
 * Whether the dev proxy is running with a key. Checked once per launch; a
 * failed check isn't remembered, so a dev server started later is found.
 */
export function devProxyAvailable(): Promise<boolean> {
  const base = devProxyBaseUrl();
  if (!base) return Promise.resolve(false);
  available ??= fetch(`${base}/status`)
    .then(async (res) => res.ok && (await res.json()).available === true)
    .catch(() => {
      available = null;
      return false;
    });
  return available;
}
