import {
  LOOKAHEAD_MS,
  LOOKBACK_MS,
} from "@/features/train-tracker/domain/config";
import {
  aucklandParts,
  gtfsTimeToMs,
  HOUR,
  nextDate,
  previousDate,
} from "@/domain/time";

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

export const RAIL = 2;
export const STATION = 1;

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
  /** 1 = no pickup: the trip terminates here and can't be boarded. */
  pickup_type?: number;
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

/**
 * Queries for the first train after the lookahead window, in order: the rest
 * of the current service day, then the next one. Before 4am the current
 * service day is all but over (and was covered by stopTripQueries), so only
 * the new day is asked about.
 */
export function laterTripQueries(
  nowMs: number,
): { query: StopTripQuery; nextServiceDay: boolean }[] {
  const { date, hour } = aucklandParts(nowMs);
  const morning = (d: string) => ({
    query: { date: d, startHour: 1, hourRange: 12 },
    nextServiceDay: true,
  });
  if (hour < 4) return [morning(date)];
  return [
    {
      query: { date, startHour: hour, hourRange: 28 - hour },
      nextServiceDay: false,
    },
    morning(nextDate(date)),
  ];
}

/** Trips you can board here, optionally only those in one direction. */
export function boardableTrips<T extends StopTrip>(
  trips: T[],
  directionId: number | null,
): T[] {
  return trips.filter(
    (t) =>
      t.pickup_type !== 1 &&
      (directionId == null || t.direction_id === directionId),
  );
}

/** Merge query results, dropping duplicates, sorted by scheduled departure. */
export function mergeSchedules(batches: StopTrip[][]): ScheduledTrip[] {
  const trips = new Map<string, ScheduledTrip>();
  for (const trip of batches.flat()) {
    trips.set(`${trip.service_date}|${trip.trip_id}`, toScheduledTrip(trip));
  }
  return [...trips.values()].sort((a, b) => a.scheduledMs - b.scheduledMs);
}
