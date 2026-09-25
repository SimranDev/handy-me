import * as SecureStore from "expo-secure-store";
import { useEffect, useSyncExternalStore } from "react";

import { devProxyAvailable } from "@/features/train-tracker/api/dev-proxy";
import { maskApiKey } from "@/features/train-tracker/domain/api-key-format";

/**
 * The user's Auckland Transport API key. Per CLAUDE.md it lives only in
 * expo-secure-store: never in env vars, logs, URLs or any other storage.
 */
const STORE_KEY = "at-api-key";

/**
 * The saved key, or null if none is saved or secure store can't be read
 * (web, or entries that can't be decrypted after a device restore).
 */
export async function getApiKey(): Promise<string | null> {
  try {
    const key = await SecureStore.getItemAsync(STORE_KEY);
    return key?.trim() || null;
  } catch {
    return null;
  }
}

export async function saveApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("API key is empty.");
  await SecureStore.setItemAsync(STORE_KEY, trimmed);
  await refreshApiKeyState();
}

export async function deleteApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
  await refreshApiKeyState();
}

/**
 * Whether a key is saved, for screens to react to. Holds only the masked
 * hint (last 4 characters), never the key itself. "dev" means none is saved
 * but the dev server's proxy has one from .env (development only).
 */
export type ApiKeyState =
  | { status: "loading" }
  | { status: "absent" }
  | { status: "dev" }
  | { status: "saved"; hint: string };

/** Whether AT requests can be made: a saved key or the dev proxy. */
export const hasUsableKey = (state: ApiKeyState) =>
  state.status === "saved" || state.status === "dev";

let state: ApiKeyState = { status: "loading" };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

async function refreshApiKeyState(): Promise<void> {
  const key = await getApiKey();
  state = key
    ? { status: "saved", hint: maskApiKey(key) }
    : (await devProxyAvailable())
      ? { status: "dev" }
      : { status: "absent" };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useApiKeyState(): ApiKeyState {
  const current = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    loading ??= refreshApiKeyState();
  }, []);
  return current;
}
