import * as SecureStore from "expo-secure-store";

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
}

export async function deleteApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
}
