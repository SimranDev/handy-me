import { AtApiError, atGet } from "@/features/train-tracker/api/at-client";
import type {
  Stop,
  StopTrip,
  StopTripQuery,
} from "@/features/train-tracker/domain/gtfs";
import type { TripUpdate } from "@/features/train-tracker/domain/realtime";
import type { TripStop } from "@/features/train-tracker/domain/upstream";

/** JSON:API envelope used by AT's GTFS v3 endpoints. */
type JsonApi<T> = { data: { type: string; id: string; attributes: T }[] };

type TripUpdatesFeed = {
  status: string;
  response?: {
    entity?: { id: string; trip_update?: TripUpdate; is_deleted?: boolean }[];
  };
};

/** The stop with this stop_code on `date`. `filter[stop_code]` keeps the payload tiny. */
export async function fetchStopByCode(
  stopCode: string,
  date: string,
  signal?: AbortSignal,
): Promise<Stop | undefined> {
  const res = await atGet<JsonApi<Stop>>(
    `/gtfs/v3/stops?filter[date]=${date}&filter[stop_code]=${encodeURIComponent(stopCode)}`,
    signal,
  );
  return res.data
    .map((d) => d.attributes)
    .find((s) => s.stop_code === stopCode);
}

/**
 * Every stop on `date` (about 7,000, 2.4 MB): the API can't filter by
 * vehicle type or partial name, so station search filters locally.
 */
export async function fetchAllStops(
  date: string,
  signal?: AbortSignal,
): Promise<Stop[]> {
  const res = await atGet<JsonApi<Stop>>(
    `/gtfs/v3/stops?filter[date]=${date}`,
    signal,
  );
  return res.data.map((d) => d.attributes);
}

/** Trips calling at a stop. AT answers 404 when the window has none. */
export async function fetchStopTrips(
  stopId: string,
  query: StopTripQuery,
  signal?: AbortSignal,
): Promise<StopTrip[]> {
  return emptyIfNotFound(async () => {
    const res = await atGet<JsonApi<StopTrip>>(
      `/gtfs/v3/stops/${encodeURIComponent(stopId)}/stoptrips` +
        `?filter[date]=${query.date}&filter[start_hour]=${query.startHour}` +
        `&filter[hour_range]=${query.hourRange}`,
      signal,
    );
    return res.data.map((d) => d.attributes);
  });
}

/** The stops a trip calls at, in order ([] if AT doesn't know the trip). */
export async function fetchTripStops(
  tripId: string,
  date: string,
  signal?: AbortSignal,
): Promise<TripStop[]> {
  return emptyIfNotFound(async () => {
    const res = await atGet<JsonApi<Stop>>(
      `/gtfs/v3/trips/${encodeURIComponent(tripId)}/stops?filter[date]=${date}`,
      signal,
    );
    return res.data.map((d) => d.attributes);
  });
}

async function emptyIfNotFound<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (err) {
    if (err instanceof AtApiError && err.status === 404) return [];
    throw err;
  }
}

/** Trip updates keyed by trip_id; trips without realtime data are absent. */
export async function fetchTripUpdates(
  tripIds: string[],
  signal?: AbortSignal,
): Promise<Map<string, TripUpdate>> {
  const updates = new Map<string, TripUpdate>();
  if (tripIds.length === 0) return updates;

  const feed = await atGet<TripUpdatesFeed>(
    `/realtime/legacy/tripupdates?tripid=${tripIds.map(encodeURIComponent).join(",")}`,
    signal,
  );
  if (feed.status !== "OK") {
    throw new AtApiError(
      "http",
      `Trip updates returned status ${feed.status}.`,
    );
  }
  for (const e of feed.response?.entity ?? []) {
    if (e.trip_update && !e.is_deleted) {
      updates.set(e.trip_update.trip.trip_id, e.trip_update);
    }
  }
  return updates;
}
