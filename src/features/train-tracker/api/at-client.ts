import { getApiKey } from "@/features/train-tracker/api/api-key";

const BASE_URL = "https://api.at.govt.nz";
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 10_000;

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
 * for each request and sent only as a header. 429 and 5xx responses and
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
    if (!key) throw new AtApiError("missing-key", "No AT API key is saved.");

    let res: Response;
    try {
      res = await fetch(BASE_URL + pathAndQuery, {
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          Accept: "application/json",
        },
        signal,
      });
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
