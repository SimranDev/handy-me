import {
  LOOKAHEAD_MS,
  LOOKBACK_MS,
} from "@/features/train-tracker/domain/config";
import {
  aucklandParts,
  gtfsTimeToMs,
  HOUR,
  previousDate,
} from "@/features/train-tracker/domain/time";

/** Attributes of a GTFS v3 `stop`. */
export type Stop = {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  location_type: number;
  parent_station?: string;
  platform_code?: string;
  /** Missing on some stops. 2 = rail, 3 = bus, 4 = ferry. */
  vehicle_type?: number;
  stop_lat: number;
  stop_lon: number;
};

/** Attributes of a GTFS v3 `stoptrip`. */
export type StopTrip = {
  trip_id: string;
  route_id: string;
  direction_id: number;
  /** GTFS time; may exceed 24:00:00 for trips after midnight. */
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
  trip_headsign: string;
  /** e.g. "Manukau via City Centre"; more readable than trip_headsign. */
  stop_headsign?: string;
  service_date: string;
};

/** A stoptrip with its scheduled departure resolved to an instant. */
export type ScheduledTrip = StopTrip & { scheduledMs: number };

export const toScheduledTrip = (trip: StopTrip): ScheduledTrip => ({
  ...trip,
  scheduledMs: gtfsTimeToMs(trip.service_date, trip.departure_time),
});

export type StopTripQuery = {
  date: string;
  startHour: number;
  hourRange: number;
};

/**
 * stoptrips queries covering LOOKBACK before `nowMs` to LOOKAHEAD after.
 * AT rejects `start_hour=0`, and trips just after midnight belong to the
 * previous service day (times like 24:30), so early hours also query that
 * day with start_hour = hour + 24.
 */
export function stopTripQueries(nowMs: number): StopTripQuery[] {
  const from = aucklandParts(nowMs - LOOKBACK_MS);
  const hourRange = Math.ceil((LOOKBACK_MS + LOOKAHEAD_MS) / HOUR) + 1;
  const queries: StopTripQuery[] = [
    { date: from.date, startHour: Math.max(from.hour, 1), hourRange },
  ];
  if (from.hour < 4) {
    queries.push({
      date: previousDate(from.date),
      startHour: from.hour + 24,
      hourRange,
    });
  }
  return queries;
}

/** Merge query results, dropping duplicates, sorted by scheduled departure. */
export function mergeSchedules(batches: StopTrip[][]): ScheduledTrip[] {
  const trips = new Map<string, ScheduledTrip>();
  for (const trip of batches.flat()) {
    trips.set(`${trip.service_date}|${trip.trip_id}`, toScheduledTrip(trip));
  }
  return [...trips.values()].sort((a, b) => a.scheduledMs - b.scheduledMs);
}
