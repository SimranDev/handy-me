export type StopTimeEvent = {
  delay?: number;
  time?: number;
  uncertainty?: number;
};

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
   * AT sends a single object (the stop the train is at or last passed), but
   * GTFS-rt allows a list that includes future stops, so accept both.
   */
  stop_time_update?: StopTimeUpdate | StopTimeUpdate[];
  vehicle?: { id?: string; label?: string };
  /** Unix seconds. Unstarted trips carry a placeholder that can be hours old. */
  timestamp?: number;
  /** Seconds; positive = late. */
  delay?: number;
};

/** TripDescriptor.schedule_relationship */
export const TRIP_CANCELLED = 3;

/**
 * StopTimeUpdate.schedule_relationship. GTFS-rt defines SKIPPED = 1; AT's docs
 * describe 3 as cancelled at stop level, so both mean "won't stop here".
 */
export const STOP_SKIPPED: ReadonlySet<number> = new Set([1, 3]);

export const stopTimeUpdates = (update: TripUpdate): StopTimeUpdate[] =>
  update.stop_time_update == null
    ? []
    : Array.isArray(update.stop_time_update)
      ? update.stop_time_update
      : [update.stop_time_update];
