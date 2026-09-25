import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { Platform } from "react-native";
import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";

import {
  parseSettings,
  serialiseSettings,
  type Settings,
} from "@/features/settings/domain/settings";

/**
 * Non-secret settings: a Zustand store saved to MMKV on every change. MMKV
 * reads synchronously, so saved settings are ready at launch. The AT API key
 * never comes through here: it lives only in secure store (see CLAUDE.md).
 */
const STORAGE_KEY = "settings.v2";
/** Where settings lived before MMKV; imported once, then removed. */
const ASYNC_STORAGE_KEY = "settings.v1";

const storage = createMMKV({ id: "settings" });

export type SettingsState =
  { status: "loading" } | { status: "ready"; settings: Settings };

function readSaved(): SettingsState {
  const raw = storage.getString(STORAGE_KEY);
  return raw == null
    ? { status: "loading" }
    : { status: "ready", settings: parseSettings(raw) };
}

/**
 * Ready at once on native, unless settings still have to come from
 * AsyncStorage. On web, MMKV is localStorage, which doesn't exist while the
 * page is rendered on the server, so web reads it in hydrateSettings.
 */
function initialState(): SettingsState {
  return Platform.OS === "web" ? { status: "loading" } : readSaved();
}

const useSettingsStore = create<SettingsState>(initialState);

let hydrating: Promise<void> | null = null;

function save(settings: Settings) {
  storage.set(STORAGE_KEY, serialiseSettings(settings));
  useSettingsStore.setState({ status: "ready", settings });
}

/**
 * Load settings if they aren't ready yet: from MMKV on web, otherwise (the
 * first launch with MMKV) bring over settings saved with AsyncStorage, or
 * start from defaults. Later calls share the first. Client only.
 */
export function hydrateSettings(): Promise<void> {
  if (hydrating == null && useSettingsStore.getState().status !== "ready") {
    const saved = readSaved();
    if (saved.status === "ready") useSettingsStore.setState(saved);
  }
  hydrating ??=
    useSettingsStore.getState().status === "ready"
      ? Promise.resolve()
      : AsyncStorage.getItem(ASYNC_STORAGE_KEY)
          .catch(() => null)
          .then((raw) => {
            // Something may have been saved while AsyncStorage was read.
            if (useSettingsStore.getState().status !== "ready") {
              save(parseSettings(raw));
            }
            if (raw != null) {
              AsyncStorage.removeItem(ASYNC_STORAGE_KEY).catch(() => {});
            }
          });
  return hydrating;
}

/** Apply a change and save it. Waits for the first load if it's still running. */
export function updateSettings(change: (current: Settings) => Settings) {
  const state = useSettingsStore.getState();
  if (state.status !== "ready") {
    hydrateSettings().then(() => updateSettings(change));
    return;
  }
  save(change(state.settings));
}

export function useSettings(): SettingsState {
  const state = useSettingsStore();
  useEffect(() => {
    hydrateSettings();
  }, []);
  return state;
}

/** A fresh id for a new commute profile. */
export function newProfileId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** For tests: forget what's in memory and load again, as a new launch would. */
export function resetSettingsStoreForTests() {
  hydrating = null;
  useSettingsStore.setState(initialState(), true);
}

/** For tests: the settings as they are now, or null while loading. */
export function currentSettingsForTests(): Settings | null {
  const state = useSettingsStore.getState();
  return state.status === "ready" ? state.settings : null;
}

/** For tests: wipe what MMKV holds. */
export function clearSettingsStorageForTests() {
  storage.remove(STORAGE_KEY);
}
