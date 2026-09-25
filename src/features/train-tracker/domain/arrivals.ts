import {
  JUST_DEPARTED_MS,
  LOOKAHEAD_MS,
  LOOKBACK_MS,
  STALE_AFTER_MS,
  TRACKED_PAST,
  TRACKED_UPCOMING,
} from "@/features/train-tracker/domain/config";
import type { ScheduledTrip } from "@/features/train-tracker/domain/gtfs";
import {
  STOP_SKIPPED,
  stopTimeUpdates,
  TRIP_CANCELLED,
  type TripUpdate,
} from "@/features/train-tracker/domain/realtime";

export type ArrivalSource = "live" | "scheduled";

export type ArrivalStatus =
  | { kind: "on-time" }
  | { kind: "late"; minutes: number }
  | { kind: "cancelled" };

export type Arrival = {
  tripId: string;
  serviceDate: string;
  headsign: string;
  /** Timetabled departure from our stop. */
  scheduledMs: number;
  /** Best estimate of departure from our stop (= scheduledMs when scheduled or cancelled). */
  etaMs: number;
  source: ArrivalSource;
  status: ArrivalStatus;
};

export type Arrivals = {
  /** Most recent train to leave, within the last few minutes. */
  justDeparted: Arrival | null;
  /** First upcoming train that isn't cancelled. */
  next: Arrival | null;
  /** Every other upcoming train (including cancelled ones), soonest first. */
  afterNext: Arrival[];
};

export const NO_ARRIVALS: Arrivals = {
  justDeparted: null,
  next: null,
  afterNext: [],
};

const LATE_THRESHOLD_SEC = 60;

type Estimate = { arrival: Arrival; departed: boolean };

/**
 * ETA at our stop, in order of preference:
 * 1. a stop_time_update for our stop,
 * 2. scheduled time + the trip's current delay (reported at another stop),
 * 3. scheduled time only.
 * Realtime older than STALE_AFTER_MS is ignored (AT's pre-trip placeholders).
 */
export function estimateArrival(
  trip: ScheduledTrip,
  update: TripUpdate | undefined,
  nowMs: number,
): Estimate {
  const base: Arrival = {
    tripId: trip.trip_id,
    serviceDate: trip.service_date,
    headsign: trip.stop_headsign ?? trip.trip_headsign,
    scheduledMs: trip.scheduledMs,
    etaMs: trip.scheduledMs,
    source: "scheduled",
    status: { kind: "on-time" },
  };
  const scheduled = (): Estimate => ({
    arrival: base,
    departed: trip.scheduledMs <= nowMs,
  });
  const cancelled = (): Estimate => ({
    arrival: { ...base, status: { kind: "cancelled" } },
    departed: false,
  });
  const live = (etaMs: number, delaySec: number, passed = false): Estimate => ({
    arrival: { ...base, etaMs, source: "live", status: statusFor(delaySec) },
    departed: passed || etaMs <= nowMs,
  });

  if (!update) return scheduled();
  if (update.trip.schedule_relationship === TRIP_CANCELLED) return cancelled();

  const stus = stopTimeUpdates(update);
  const mine = stus.find(
    (s) => s.stop_id === trip.stop_id || s.stop_sequence === trip.stop_sequence,
  );
  if (
    mine?.schedule_relationship != null &&
    STOP_SKIPPED.has(mine.schedule_relationship)
  ) {
    return cancelled();
  }

  if (mine) {
    const event = mine.departure ?? mine.arrival;
    if (event?.time != null) {
      const etaMs = event.time * 1000;
      return live(
        etaMs,
        event.delay ?? Math.round((etaMs - trip.scheduledMs) / 1000),
      );
    }
    if (event?.delay != null) {
      return live(trip.scheduledMs + event.delay * 1000, event.delay);
    }
  }

  // Latest update is for another stop. Has the train already passed ours?
  const latestSeq = stus.reduce<number | undefined>(
    (max, s) =>
      s.stop_sequence != null && (max == null || s.stop_sequence > max)
        ? s.stop_sequence
        : max,
    undefined,
  );
  const passed = latestSeq != null && latestSeq > trip.stop_sequence;

  const fresh =
    update.timestamp != null &&
    nowMs - update.timestamp * 1000 <= STALE_AFTER_MS;
  const last = stus.at(-1);
  const delaySec =
    update.delay ?? last?.departure?.delay ?? last?.arrival?.delay;
  if (fresh && delaySec != null) {
    return live(trip.scheduledMs + delaySec * 1000, delaySec, passed);
  }

  const estimate = scheduled();
  return { ...estimate, departed: passed || estimate.departed };
}

function statusFor(delaySec: number): ArrivalStatus {
  return delaySec >= LATE_THRESHOLD_SEC
    ? { kind: "late", minutes: Math.round(delaySec / 60) }
    : { kind: "on-time" };
}

/**
 * Trips worth asking the realtime feed about: the last few scheduled before
 * now (they may be running late, or have just left) and the next few after.
 */
export function pickTrackedTrips(
  schedule: ScheduledTrip[],
  nowMs: number,
): ScheduledTrip[] {
  const window = schedule.filter(
    (t) =>
      t.scheduledMs >= nowMs - LOOKBACK_MS &&
      t.scheduledMs <= nowMs + LOOKAHEAD_MS,
  );
  return [
    ...window.filter((t) => t.scheduledMs < nowMs).slice(-TRACKED_PAST),
    ...window.filter((t) => t.scheduledMs >= nowMs).slice(0, TRACKED_UPCOMING),
  ];
}

export function buildArrivals(
  trips: ScheduledTrip[],
  updates: ReadonlyMap<string, TripUpdate>,
  nowMs: number,
): Arrivals {
  const estimates = trips.map((t) =>
    estimateArrival(t, updates.get(t.trip_id), nowMs),
  );

  const justDeparted =
    estimates
      .filter(
        (e) =>
          e.departed &&
          e.arrival.status.kind !== "cancelled" &&
          e.arrival.etaMs >= nowMs - JUST_DEPARTED_MS,
      )
      .sort((a, b) => a.arrival.etaMs - b.arrival.etaMs)
      .at(-1)?.arrival ?? null;

  const upcoming = estimates
    .filter((e) =>
      e.arrival.status.kind === "cancelled"
        ? e.arrival.scheduledMs >= nowMs
        : !e.departed,
    )
    .map((e) => e.arrival)
    .sort((a, b) => a.etaMs - b.etaMs);

  const next = upcoming.find((a) => a.status.kind !== "cancelled") ?? null;
  return {
    justDeparted,
    next,
    afterNext: upcoming.filter((a) => a !== next),
  };
}
