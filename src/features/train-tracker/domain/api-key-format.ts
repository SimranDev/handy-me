/**
 * Checks on a pasted AT API key before it's tried against the API. AT keys
 * are 32 hex characters today; the check is looser so a format change on
 * AT's side doesn't lock anyone out, since the API has the final say.
 */
export type KeyFormat =
  { ok: true; key: string } | { ok: false; message: string };

const MIN_LENGTH = 16;
const MAX_LENGTH = 128;

export function checkApiKeyFormat(input: string): KeyFormat {
  const key = input.trim();
  if (!key) return { ok: false, message: "Paste your API key first." };
  if (/\s/.test(key)) {
    return {
      ok: false,
      message:
        "That has spaces in it. Copy just the key from the AT developer portal.",
    };
  }
  if (key.length < MIN_LENGTH) {
    return {
      ok: false,
      message:
        "That's too short for an AT API key. Check you copied all of it.",
    };
  }
  if (key.length > MAX_LENGTH) {
    return {
      ok: false,
      message: "That's too long for an AT API key. Copy just the key.",
    };
  }
  return { ok: true, key };
}

/** "•••• 1a2b": only the last 4 characters are ever shown. */
export function maskApiKey(key: string): string {
  return `•••• ${key.trim().slice(-4)}`;
}

/** Result of trying a key against the AT API. */
export type ApiKeyCheck =
  "valid" | "invalid" | "rate-limited" | "network" | "unavailable";

/** What to tell the user when a key check fails. Nothing has been saved. */
export function describeKeyCheck(
  result: Exclude<ApiKeyCheck, "valid">,
): string {
  switch (result) {
    case "invalid":
      return "Auckland Transport didn't accept this key. Check you copied the primary key from your subscription on the developer portal.";
    case "network":
      return "Couldn't reach Auckland Transport to check the key. Check your connection and try again. Nothing was saved.";
    case "rate-limited":
      return "Auckland Transport is getting too many requests. Wait a minute and try again. Nothing was saved.";
    case "unavailable":
      return "Auckland Transport couldn't check the key just now. Try again in a few minutes. Nothing was saved.";
  }
}
