import { atGet } from "./at.ts";

export type StopTimeEvent = { delay?: number; time?: number; uncertainty?: number };

export type StopTimeUpdate = {
  stop_sequence?: number;
  stop_id?: string;
  arrival?: StopTimeEvent;
  departure?: StopTimeEvent;
  schedule_relationship?: number;
};

export type TripUpdate = {
  trip: {
    trip_id: string;
    start_time?: string;
    start_date?: string;
    schedule_relationship?: number;
    route_id?: string;
    direction_id?: number;
  };
  /**
   * Observed as a single object (the stop the train is at or last passed),
   * but GTFS-rt allows a list including future stops, so accept both.
   */
  stop_time_update?: StopTimeUpdate | StopTimeUpdate[];
  vehicle?: { id?: string; label?: string };
  /** Unix seconds. Unstarted trips carry a placeholder that can be many hours old. */
  timestamp?: number;
  /** Seconds; positive = late. */
  delay?: number;
};

type Feed = {
  status: string;
  error: unknown;
  response: {
    header: { timestamp: number };
    entity: { id: string; trip_update?: TripUpdate; is_deleted?: boolean }[];
  };
};

/** TripDescriptor.schedule_relationship */
export const TRIP_CANCELLED = 3;
/**
 * StopTimeUpdate.schedule_relationship. GTFS-rt defines SKIPPED = 1; AT's docs
 * describe 3 as cancelled at stop level, so both mean "won't stop here".
 */
export const STOP_SKIPPED = new Set([1, 3]);

export const stopTimeUpdates = (u: TripUpdate): StopTimeUpdate[] =>
  u.stop_time_update == null
    ? []
    : Array.isArray(u.stop_time_update)
      ? u.stop_time_update
      : [u.stop_time_update];

/** Trip updates keyed by trip_id. Trips with no realtime data are simply absent. */
export async function getTripUpdates(
  tripIds: string[],
  sample?: string,
): Promise<Map<string, TripUpdate>> {
  const updates = new Map<string, TripUpdate>();
  if (tripIds.length === 0) return updates;
  const feed = await atGet<Feed>(
    `/realtime/legacy/tripupdates?tripid=${tripIds.map(encodeURIComponent).join(",")}`,
    sample,
  );
  if (feed.status !== "OK") throw new Error(`tripupdates status ${feed.status}: ${JSON.stringify(feed.error)}`);
  for (const e of feed.response.entity) {
    if (e.trip_update && !e.is_deleted) updates.set(e.trip_update.trip.trip_id, e.trip_update);
  }
  return updates;
}
