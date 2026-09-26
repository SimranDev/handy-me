import { getTimes } from "suncalc";

import type { Phase } from "@/constants/theme";
import {
  aucklandParts,
  gtfsTimeToMs,
  nextDate,
  previousDate,
} from "@/domain/time";

/** Where the sky is computed for. */
export const AUCKLAND = { latitude: -36.85, longitude: 174.76 } as const;

/** Sun events for one Auckland calendar day, as instants (ms). */
export type DayTimes = {
  /** Start of civil twilight (sun 6° below the horizon). */
  dawn: number;
  sunrise: number;
  solarNoon: number;
  sunset: number;
  /** End of civil twilight. */
  dusk: number;
};

export type Sky = {
  /**
   * Continuous position through the day, used to blend the four palettes:
   * 0 night (until civil dawn) → 1 dawn (sunrise) → 2 midday (held through
   * the middle of the day) → 3 dusk (sunset) → 4 night (from civil dusk).
   */
  progress: number;
  /** Nearest palette, for greetings and anything that needs one answer. */
  phase: Phase;
  /** 0–1: stars and the moon. */
  night: number;
  /** 0–1: the train's headlight beam and the glow around your station. */
  lights: number;
  /** 0–1: midday clouds. */
  clouds: number;
  /**
   * Sun's place on its arc: 0 at sunrise, 1 at sunset. Runs slightly past
   * both during twilight (so it sinks below the hills); null at night.
   */
  sun: number | null;
  /** Moon's place on its night arc: 0 at civil dusk, 1 at the next civil dawn; null by day. */
  moon: number | null;
};

// Used only if suncalc can't find an event (never at Auckland's latitude).
const FALLBACK: Record<keyof DayTimes, string> = {
  dawn: "05:30:00",
  sunrise: "06:00:00",
  solarNoon: "12:30:00",
  sunset: "18:00:00",
  dusk: "18:30:00",
};

const cache = new Map<string, DayTimes>();

/** Sun events for an Auckland date (YYYY-MM-DD). Cached. */
export function dayTimes(date: string): DayTimes {
  const cached = cache.get(date);
  if (cached) return cached;

  // Ask for the day around local noon so suncalc picks the right solar day.
  const noon = new Date(gtfsTimeToMs(date, "12:00:00"));
  const t = getTimes(noon, AUCKLAND.latitude, AUCKLAND.longitude);
  const at = (key: keyof DayTimes) => {
    const ms = t[key]?.getTime();
    return ms != null && Number.isFinite(ms)
      ? ms
      : gtfsTimeToMs(date, FALLBACK[key]);
  };
  const times: DayTimes = {
    dawn: at("dawn"),
    sunrise: at("sunrise"),
    solarNoon: at("solarNoon"),
    sunset: at("sunset"),
    dusk: at("dusk"),
  };

  if (cache.size > 7) cache.clear();
  cache.set(date, times);
  return times;
}

export function skyAt(nowMs: number): Sky {
  const { date } = aucklandParts(nowMs);
  const day = dayTimes(date);

  const morning = (day.sunrise + day.solarNoon) / 2;
  const afternoon = (day.solarNoon + day.sunset) / 2;
  const progress = piecewise(
    nowMs,
    [day.dawn, day.sunrise, morning, afternoon, day.sunset, day.dusk],
    [0, 1, 2, 2, 3, 4],
  );

  const isDay = nowMs >= day.dawn && nowMs < day.dusk;
  let moon: number | null = null;
  if (!isDay) {
    const [start, end] =
      nowMs < day.dawn
        ? [dayTimes(previousDate(date)).dusk, day.dawn]
        : [day.dusk, dayTimes(nextDate(date)).dawn];
    moon = (nowMs - start) / (end - start);
  }

  return {
    progress,
    phase: phaseOf(progress),
    night: clamp01(Math.max(1 - progress, progress - 3)),
    lights:
      progress >= 2.5
        ? clamp01((progress - 2.5) * 2)
        : clamp01((1 - progress) * 2),
    clouds: clamp01(1 - Math.abs(progress - 2)),
    sun: isDay ? (nowMs - day.sunrise) / (day.sunset - day.sunrise) : null,
    moon,
  };
}

export function phaseOf(progress: number): Phase {
  if (progress < 0.5 || progress >= 3.5) return "night";
  if (progress < 1.5) return "dawn";
  if (progress < 2.5) return "midday";
  return "dusk";
}

/** "Good morning" before noon even once the sky has turned to midday. */
export function greetingFor(phase: Phase, nowMs: number): string {
  switch (phase) {
    case "dawn":
      return "Good morning";
    case "midday":
      return aucklandParts(nowMs).hour < 12 ? "Good morning" : "Good afternoon";
    case "dusk":
      return "Good evening";
    default:
      return "Late one";
  }
}

/** Linear interpolation through (xs, ys), clamped to the ends. */
function piecewise(x: number, xs: number[], ys: number[]): number {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x < xs[i]) {
      const u = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + (ys[i] - ys[i - 1]) * u;
    }
  }
  return ys[ys.length - 1];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
