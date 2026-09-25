import { useSyncExternalStore } from "react";

export type DataSource = "mock" | "live";

/**
 * Where train data comes from by default, set by EXPO_PUBLIC_DATA_SOURCE in
 * .env (defaults to "mock"). This only picks the source: the AT API key is
 * never read from EXPO_PUBLIC_ env; see CLAUDE.md.
 */
export const ENV_DATA_SOURCE: DataSource = parseDataSource(
  // Must stay a static dot-access so Expo can inline it at build time.
  process.env.EXPO_PUBLIC_DATA_SOURCE,
);

function parseDataSource(value: string | undefined): DataSource {
  if (value == null || value === "") return "mock";
  if (value === "mock" || value === "live") return value;
  throw new Error(
    `EXPO_PUBLIC_DATA_SOURCE must be "mock" or "live", got "${value}".`,
  );
}

/**
 * Dev-menu override of the data source. Held in memory only, like the sky
 * preview, so relaunching the app always returns to the .env default.
 */
let override: DataSource | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The data source in use: the dev-menu override, else the .env default. */
export function getDataSource(): DataSource {
  return override ?? ENV_DATA_SOURCE;
}

export function useDataSource(): DataSource {
  return useSyncExternalStore(subscribe, getDataSource, getDataSource);
}

/** Switch the data source until the app restarts. */
export function setDataSource(source: DataSource) {
  const next = source === ENV_DATA_SOURCE ? null : source;
  if (next === override) return;
  override = next;
  listeners.forEach((listener) => listener());
}
