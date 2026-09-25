import type { Arrivals } from "@/features/train-tracker/domain/arrivals";

/** Where arrivals come from: the AT API or the built-in mock timetable. */
export interface ArrivalsSource {
  getArrivals(nowMs: number, signal?: AbortSignal): Promise<Arrivals>;
}
