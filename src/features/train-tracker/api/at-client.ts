import { getApiKey } from "@/features/train-tracker/api/api-key";
import {
  devProxyAvailable,
  devProxyBaseUrl,
} from "@/features/train-tracker/api/dev-proxy";
import type { ApiKeyCheck } from "@/features/train-tracker/domain/api-key-format";

const BASE_URL = "https://api.at.govt.nz";
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 10_000;
/** A request that takes longer than this counts as a network failure. */
const TIMEOUT_MS = 15_000;

export type AtErrorKind =
  "missing-key" | "unauthorized" | "rate-limited" | "network" | "http";

/** Messages never include the key, request headers or response bodies. */
export class AtApiError extends Error {
  constructor(
    readonly kind: AtErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AtApiError";
  }
}

/**
 * GET an AT API path and parse the JSON. The key is read from secure store
 * for each request and sent only as a header. In development with no saved
 * key, the request goes through the dev server's proxy, which adds the key
 * from .env (see dev-proxy.ts). 429 and 5xx responses and
 * network failures are retried with exponential backoff (honouring
 * Retry-After); 401/403 fail immediately.
 */
export async function atGet<T>(
  pathAndQuery: string,
  signal?: AbortSignal,
): Promise<T> {
  const endpoint = pathAndQuery.split("?")[0];

  for (let attempt = 1; ; attempt++) {
    const key = await getApiKey();
    const base = key
      ? BASE_URL
      : (await devProxyAvailable())
        ? devProxyBaseUrl()
        : null;
    if (!base) throw new AtApiError("missing-key", "No AT API key is saved.");

    let res: Response;
    try {
      res = await send(base + pathAndQuery, key, signal);
    } catch (err) {
      if (signal?.aborted) throw err;
      if (attempt >= MAX_ATTEMPTS) {
        throw new AtApiError("network", "Can't reach Auckland Transport.");
      }
      await sleep(backoffMs(attempt), signal);
      continue;
    }

    if (res.ok) {
      try {
        return (await res.json()) as T;
      } catch {
        throw new AtApiError("http", `Unreadable response from ${endpoint}.`);
      }
    }
    if (res.status === 401 || res.status === 403) {
      throw new AtApiError(
        "unauthorized",
        "Auckland Transport rejected the API key.",
        res.status,
      );
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      await sleep(retryAfterMs(res) ?? backoffMs(attempt), signal);
      continue;
    }
    throw res.status === 429
      ? new AtApiError(
          "rate-limited",
          "Too many requests to Auckland Transport.",
          429,
        )
      : new AtApiError(
          "http",
          `AT API ${res.status} for ${endpoint}.`,
          res.status,
        );
  }
}

/**
 * Try a key the user typed, before it's saved, with one call to the tiny
 * GTFS versions endpoint. Not retried: the user is waiting and can try again.
 */
export async function verifyApiKey(
  candidate: string,
  signal?: AbortSignal,
): Promise<ApiKeyCheck> {
  let res: Response;
  try {
    res = await send(`${BASE_URL}/gtfs/v3/versions`, candidate.trim(), signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    return "network";
  }
  if (res.ok) return "valid";
  if (res.status === 401 || res.status === 403) return "invalid";
  if (res.status === 429) return "rate-limited";
  return "unavailable";
}

/**
 * One GET, aborted after TIMEOUT_MS. The key goes only in the header; it's
 * null for the dev proxy, which adds its own.
 */
async function send(
  url: string,
  key: string | null,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, TIMEOUT_MS);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  try {
    return await fetch(url, {
      headers: key
        ? { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" }
        : { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

/** 1s, 2s, 4s… with jitter, capped. */
function backoffMs(attempt: number): number {
  const ms = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
  return ms / 2 + Math.random() * (ms / 2);
}

function retryAfterMs(res: Response): number | undefined {
  const header = res.headers.get("Retry-After");
  if (!header) return undefined;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(header) - Date.now();
  return Number.isFinite(ms) && ms > 0
    ? Math.min(ms, MAX_BACKOFF_MS)
    : undefined;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
