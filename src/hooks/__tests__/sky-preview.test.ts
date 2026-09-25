import { HOUR } from "@/domain/time";
import {
  clearSkyPreview,
  getSkyPreview,
  pauseSkyPreview,
  PLAY_DAY_MS,
  playSkyPreview,
  previewSkyAt,
} from "@/hooks/sky-preview";

const NOON = Date.parse("2026-12-21T12:00:00+13:00");

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  clearSkyPreview();
  jest.useRealTimers();
});

describe("sky preview", () => {
  it("starts on the real sky and holds a previewed instant", () => {
    expect(getSkyPreview()).toEqual({ at: null, playing: false });

    previewSkyAt(NOON);
    expect(getSkyPreview()).toEqual({ at: NOON, playing: false });

    clearSkyPreview();
    expect(getSkyPreview()).toEqual({ at: null, playing: false });
  });

  it("plays a whole day in PLAY_DAY_MS, then pauses where it is", () => {
    previewSkyAt(NOON);
    playSkyPreview();
    expect(getSkyPreview().playing).toBe(true);

    jest.advanceTimersByTime(PLAY_DAY_MS);
    expect(getSkyPreview().at).toBe(NOON + 24 * HOUR);

    pauseSkyPreview();
    jest.advanceTimersByTime(PLAY_DAY_MS);
    expect(getSkyPreview()).toEqual({ at: NOON + 24 * HOUR, playing: false });
  });

  it("stops playing when a moment is picked", () => {
    playSkyPreview();
    previewSkyAt(NOON);
    jest.advanceTimersByTime(PLAY_DAY_MS);
    expect(getSkyPreview()).toEqual({ at: NOON, playing: false });
  });
});
