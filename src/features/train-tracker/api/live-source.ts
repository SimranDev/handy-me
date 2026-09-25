import {
  fetchStopByCode,
  fetchStopTrips,
  fetchTripStops,
  fetchTripUpdates,
} from "@/features/train-tracker/api/at-api";
import {
  buildArrivals,
  type LaterTrain,
  pickLaterTrain,
  pickTrackedTrips,
} from "@/features/train-tracker/domain/arrivals";
import type {
  ArrivalsSource,
  CommuteStop,
} from "@/features/train-tracker/domain/arrivals-source";
import { SCHEDULE_TTL_MS } from "@/features/train-tracker/domain/config";
import {
  boardableTrips,
  laterTripQueries,
  mergeSchedules,
  type ScheduledTrip,
  stopTripQueries,
} from "@/features/train-tracker/domain/gtfs";
import { createStopResolver } from "@/features/train-tracker/domain/stop-resolver";
import { aucklandParts } from "@/domain/time";

/**
 * Arrivals from the AT API for one platform (and direction, if chosen). Per
 * poll: one realtime call; the stop is resolved once per service day and the
 * timetable is refetched every SCHEDULE_TTL_MS. When nothing is due in the
 * window, the first later train is looked up (at most every SCHEDULE_TTL_MS).
 */
export function createLiveArrivalsSource({
  stopCode,
  directionId,
}: CommuteStop): ArrivalsSource {
  // Not tied to a caller's AbortSignal: the cached promise is shared.
  const resolveStop = createStopResolver((code, date) =>
    fetchStopByCode(code, date),
  );
  let schedule: {
    stopId: string;
    loadedAt: number;
    trips: ScheduledTrip[];
  } | null = null;
  let later: {
    stopId: string;
    loadedAt: number;
    train: LaterTrain | null;
  } | null = null;

  const boardable = (batches: Parameters<typeof mergeSchedules>[0]) =>
    boardableTrips(mergeSchedules(batches), directionId);

  async function findLater(
    stopId: string,
    nowMs: number,
    trackedIds: ReadonlySet<string>,
    signal?: AbortSignal,
  ): Promise<LaterTrain | null> {
    const cached =
      later &&
      later.stopId === stopId &&
      nowMs - later.loadedAt <= SCHEDULE_TTL_MS &&
      (later.train == null || later.train.scheduledMs > nowMs);
    if (cached) return later!.train;

    let train: LaterTrain | null = null;
    for (const { query, nextServiceDay } of laterTripQueries(nowMs)) {
      const trips = boardable([await fetchStopTrips(stopId, query, signal)]);
      train = pickLaterTrain([{ trips, nextServiceDay }], nowMs, trackedIds);
      if (train) break;
    }
    later = { stopId, loadedAt: nowMs, train };
    return train;
  }

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
          trips: boardable(batches),
        };
        // AT answers 404 (read as "no trips") for a stop_id from an older
        // GTFS version too, so look the stop up again next time.
        if (batches.every((b) => b.length === 0)) resolveStop.forget(stopCode);
      }

      const tracked = pickTrackedTrips(schedule.trips, nowMs);
      const updates = await fetchTripUpdates(
        tracked.map((t) => t.trip_id),
        signal,
      );
      const arrivals = buildArrivals(tracked, updates, nowMs);
      if (arrivals.next) return arrivals;

      const trackedIds = new Set(tracked.map((t) => t.trip_id));
      return {
        ...arrivals,
        later: await findLater(stop.stop_id, nowMs, trackedIds, signal),
      };
    },

    getTripStops(tripId, serviceDate, signal) {
      return fetchTripStops(tripId, serviceDate, signal);
    },
  };
}
