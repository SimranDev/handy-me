import { useSyncExternalStore } from "react";

import { HOUR } from "@/domain/time";

/**
 * Dev-menu override for the sky: draw it (and the palette) at another instant
 * while everything else, like train countdowns, keeps real time. Held in
 * memory only, so relaunching the app always returns to the real sky.
 */
export type SkyPreview = {
  /** Instant (ms) the sky is drawn at, or null for the real sky. */
  at: number | null;
  /** Whether the preview is running through the day on its own. */
  playing: boolean;
};

/** One tick of playback. */
export const PLAY_TICK_MS = 50;
/** How long a whole day takes to play through. */
export const PLAY_DAY_MS = 20_000;
const PLAY_STEP_MS = (24 * HOUR * PLAY_TICK_MS) / PLAY_DAY_MS;

const REAL_SKY: SkyPreview = { at: null, playing: false };

let state = REAL_SKY;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function emit(next: SkyPreview) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSkyPreview(): SkyPreview {
  return state;
}

export function useSkyPreview(): SkyPreview {
  return useSyncExternalStore(subscribe, getSkyPreview, getSkyPreview);
}

/** Hold the sky at `ms`, stopping playback. */
export function previewSkyAt(ms: number) {
  pauseSkyPreview();
  emit({ at: ms, playing: false });
}

/** Run the sky forward from where it is shown now, a day every PLAY_DAY_MS. */
export function playSkyPreview() {
  if (timer) return;
  emit({ at: state.at ?? Date.now(), playing: true });
  timer = setInterval(
    () => emit({ at: (state.at ?? Date.now()) + PLAY_STEP_MS, playing: true }),
    PLAY_TICK_MS,
  );
}

/** Stop playback, holding the sky where it is. */
export function pauseSkyPreview() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  emit({ ...state, playing: false });
}

/** Back to the real sky. */
export function clearSkyPreview() {
  pauseSkyPreview();
  emit(REAL_SKY);
}
