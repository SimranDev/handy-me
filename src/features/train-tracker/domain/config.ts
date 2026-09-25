import { MINUTE } from "@/domain/time";

/** How far ahead to look for trains. */
export const LOOKAHEAD_MS = 120 * MINUTE;
/** How far back to keep trips, so late-running and just-departed trains stay visible. */
export const LOOKBACK_MS = 20 * MINUTE;
/** A departed train stays in `justDeparted` for this long. */
export const JUST_DEPARTED_MS = 5 * MINUTE;
/** Realtime older than this is a placeholder, not a prediction. */
export const STALE_AFTER_MS = 15 * MINUTE;
/** Timetable (stoptrips) is refetched this often. */
export const SCHEDULE_TTL_MS = 10 * MINUTE;

/** Trips sent to the realtime feed: recent departures plus the next few. */
export const TRACKED_PAST = 2;
export const TRACKED_UPCOMING = 3;

/** Stations drawn on the line before yours. */
export const SCENE_STATIONS = 4;

/**
 * Trips sampled to find which directions a platform serves: a daytime window
 * gives a representative mix of services whatever the time now.
 */
export const DIRECTION_SAMPLE_START_HOUR = 6;
export const DIRECTION_SAMPLE_HOUR_RANGE = 12;
