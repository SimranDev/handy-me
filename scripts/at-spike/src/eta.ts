import type { ScheduledTrip } from "./gtfs.ts";
import { STOP_SKIPPED, stopTimeUpdates, TRIP_CANCELLED, type TripUpdate } from "./realtime.ts";

/** Realtime older than this is treated as a placeholder, not a prediction. */
export const STALE_AFTER_MS = 15 * 60_000;

export type Eta = {
  trip: ScheduledTrip;
  /** Best estimate of departure from our stop. */
  etaMs: number;
  source: "live" | "scheduled";
  /** How the estimate was made, for debugging. */
  basis: string;
  delaySec?: number;
  cancelled: boolean;
  departed: boolean;
};

/**
 * ETA at our stop, in order of preference:
 * 1. a stop_time_update for our stop,
 * 2. scheduled time + the trip's current delay (from an earlier stop),
 * 3. scheduled time only.
 */
export function estimate(trip: ScheduledTrip, update: TripUpdate | undefined, nowMs: number): Eta {
  const scheduled: Eta = {
    trip,
    etaMs: trip.scheduledMs,
    source: "scheduled",
    basis: update ? "realtime stale" : "no realtime",
    cancelled: false,
    departed: trip.scheduledMs <= nowMs,
  };
  if (!update) return scheduled;

  if (update.trip.schedule_relationship === TRIP_CANCELLED) {
    return { ...scheduled, basis: "trip cancelled", cancelled: true };
  }

  const stus = stopTimeUpdates(update);
  const mine = stus.find((s) => s.stop_id === trip.stop_id || s.stop_sequence === trip.stop_sequence);
  if (mine && mine.schedule_relationship != null && STOP_SKIPPED.has(mine.schedule_relationship)) {
    return { ...scheduled, basis: "stop skipped", cancelled: true };
  }

  if (mine) {
    const event = mine.departure ?? mine.arrival;
    const delaySec = event?.delay;
    const etaMs =
      event?.time != null ? event.time * 1000 : delaySec != null ? trip.scheduledMs + delaySec * 1000 : null;
    if (etaMs != null) {
      return { ...scheduled, etaMs, source: "live", basis: "update at our stop", delaySec, departed: etaMs <= nowMs };
    }
  }

  // The latest update is for another stop. Has the train already passed us?
  const latest = stus.reduce<number | undefined>(
    (max, s) => (s.stop_sequence != null && (max == null || s.stop_sequence > max) ? s.stop_sequence : max),
    undefined,
  );
  const passed = latest != null && latest > trip.stop_sequence;

  const fresh = update.timestamp != null && nowMs - update.timestamp * 1000 <= STALE_AFTER_MS;
  const last = stus.at(-1);
  const delaySec = update.delay ?? last?.departure?.delay ?? last?.arrival?.delay;
  if (fresh && delaySec != null) {
    const etaMs = trip.scheduledMs + delaySec * 1000;
    return {
      ...scheduled,
      etaMs,
      source: "live",
      basis: `delay from stop seq ${latest ?? "?"}`,
      delaySec,
      departed: passed || etaMs <= nowMs,
    };
  }

  return { ...scheduled, departed: passed || scheduled.departed };
}
