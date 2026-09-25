import {
  fetchStopByCode,
  fetchStopTrips,
  fetchTripUpdates,
} from "@/features/train-tracker/api/at-api";
import {
  buildArrivals,
  pickTrackedTrips,
} from "@/features/train-tracker/domain/arrivals";
import type { ArrivalsSource } from "@/features/train-tracker/domain/arrivals-source";
import { SCHEDULE_TTL_MS } from "@/features/train-tracker/domain/config";
import {
  mergeSchedules,
  type ScheduledTrip,
  stopTripQueries,
} from "@/features/train-tracker/domain/gtfs";
import { createStopResolver } from "@/features/train-tracker/domain/stop-resolver";
import { aucklandParts } from "@/features/train-tracker/domain/time";

/**
 * Arrivals from the AT API. Per poll: one realtime call; the stop is resolved
 * once per service day and the timetable is refetched every SCHEDULE_TTL_MS.
 */
export function createLiveArrivalsSource(stopCode: string): ArrivalsSource {
  // Not tied to a caller's AbortSignal: the cached promise is shared.
  const resolveStop = createStopResolver((code, date) =>
    fetchStopByCode(code, date),
  );
  let schedule: {
    stopId: string;
    loadedAt: number;
    trips: ScheduledTrip[];
  } | null = null;

  return {
    async getArrivals(nowMs, signal) {
      const stop = await resolveStop(stopCode, aucklandParts(nowMs).date);

      if (
        !schedule ||
        schedule.stopId !== stop.stop_id ||
        nowMs - schedule.loadedAt > SCHEDULE_TTL_MS
      ) {
        const batches = await Promise.all(
          stopTripQueries(nowMs).map((q) =>
            fetchStopTrips(stop.stop_id, q, signal),
          ),
        );
        schedule = {
          stopId: stop.stop_id,
          loadedAt: nowMs,
          trips: mergeSchedules(batches),
        };
      }

      const tracked = pickTrackedTrips(schedule.trips, nowMs);
      const updates = await fetchTripUpdates(
        tracked.map((t) => t.trip_id),
        signal,
      );
      return buildArrivals(tracked, updates, nowMs);
    },
  };
}
