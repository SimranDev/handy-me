import type { Arrivals } from "@/features/train-tracker/domain/arrivals";
import type { TripStop } from "@/features/train-tracker/domain/upstream";

/** The platform (and direction on it) the commute leaves from. */
export type CommuteStop = {
  /** Stable across GTFS versions, unlike stop_id. */
  stopCode: string;
  /** Only trains in this direction; null for every train at the platform. */
  directionId: number | null;
};

/** Where arrivals come from: the AT API or the built-in mock timetable. */
export interface ArrivalsSource {
  getArrivals(nowMs: number, signal?: AbortSignal): Promise<Arrivals>;
  /** The stops a trip calls at, in order, for drawing the line. */
  getTripStops(
    tripId: string,
    serviceDate: string,
    signal?: AbortSignal,
  ): Promise<TripStop[]>;
}
