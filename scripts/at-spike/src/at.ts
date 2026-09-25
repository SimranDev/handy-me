import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES_DIR = path.join(ROOT, "samples");
const BASE_URL = "https://api.at.govt.nz";

config({ path: path.join(ROOT, ".env"), quiet: true });

export const TZ = "Pacific/Auckland";

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Add it to scripts/at-spike/.env (see .env.example).`);
  }
  return value;
}

let calls = 0;
export const callCount = () => calls;

/**
 * GET an AT API path and return parsed JSON. When `sample` is given the raw
 * body is written to samples/<sample>.json for use as a test fixture.
 * The subscription key is only ever sent as a header, never logged.
 */
export async function atGet<T>(pathAndQuery: string, sample?: string): Promise<T> {
  const key = requireEnv("AT_API_KEY");
  calls++;
  const res = await fetch(BASE_URL + pathAndQuery, {
    headers: { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" },
  });
  const body = await res.text();
  if (sample) await saveSample(sample, body);
  if (!res.ok) {
    throw new Error(`AT API ${res.status} ${res.statusText} for ${pathAndQuery}: ${body.slice(0, 300)}`);
  }
  return JSON.parse(body) as T;
}

async function saveSample(name: string, body: string) {
  await mkdir(SAMPLES_DIR, { recursive: true });
  let pretty = body;
  try {
    pretty = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    // Keep non-JSON bodies (e.g. error pages) as-is.
  }
  await writeFile(path.join(SAMPLES_DIR, `${name}.json`), pretty + "\n");
}
