import { MINUTE } from "@/domain/time";

/** Sunnyvale platform 1, city-bound. stop_code is stable; stop_id is not. */
export const HOME_STOP_CODE = "9320";

/** Assumed walk from home to the platform. */
export const WALK_MINUTES = 7;

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
