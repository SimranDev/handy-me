/**
 * Real AT API responses captured by scripts/at-spike (Sunnyvale platform 1,
 * 2026-09-25 around 23:54 NZST), trimmed to a handful of stops and trips.
 */
import stopsJson from "../../../../../scripts/at-spike/samples/fixture-stops-sunnyvale-2026-09-25.json";
import stopTripsJson from "../../../../../scripts/at-spike/samples/fixture-stoptrips-9320-2026-09-25-h23.json";
import tripUpdatesJson from "../../../../../scripts/at-spike/samples/fixture-tripupdates-2026-09-25T235343.json";

import {
  mergeSchedules,
  type ScheduledTrip,
  type Stop,
  type StopTrip,
} from "@/features/train-tracker/domain/gtfs";
import type { TripUpdate } from "@/features/train-tracker/domain/realtime";

export const fixtureStops = stopsJson.data.map(
  (d) => d.attributes,
) as unknown as Stop[];

export const fixtureStopTrips = stopTripsJson.data.map(
  (d) => d.attributes,
) as unknown as StopTrip[];

export const fixtureSchedule: ScheduledTrip[] = mergeSchedules([
  fixtureStopTrips,
]);

/** When the realtime snapshot was taken. */
export const fixtureNowMs = Math.floor(
  tripUpdatesJson.response.header.timestamp * 1000,
);

/** A fresh copy each call, so tests can patch updates freely. */
export function fixtureUpdates(): Map<string, TripUpdate> {
  const entities = structuredClone(tripUpdatesJson.response.entity) as {
    trip_update: TripUpdate;
  }[];
  return new Map(
    entities.map((e) => [e.trip_update.trip.trip_id, e.trip_update]),
  );
}

/** Trip ids in the fixtures, by their (unique) last 8 characters. */
export const TRIPS = {
  /** 23:34, passed our stop, 97s late. */
  passed: "258-880002-84180-2-W199550-62cec80b",
  /** 23:42, no realtime. */
  departedNoRealtime: "259-860002-85200-2-H1471002-7eb32edb",
  /** 24:04, approaching, fresh update at an earlier stop, 9s late. */
  approaching: "258-880002-85980-2-W201570-b7d718b1",
  /** 24:12, stale pre-trip placeholder (~15h old). */
  stale: "259-860002-87000-2-H149401-2a1b6036",
  /** 24:34, no realtime. */
  laterNoRealtime: "258-880002-87780-2-W203600-5735decc",
} as const;

export function scheduledTrip(tripId: string): ScheduledTrip {
  const trip = fixtureSchedule.find((t) => t.trip_id === tripId);
  if (!trip) throw new Error(`No fixture trip ${tripId}`);
  return trip;
}
