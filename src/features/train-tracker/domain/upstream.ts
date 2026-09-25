import { SCENE_STATIONS } from "@/features/train-tracker/domain/config";
import type { Stop } from "@/features/train-tracker/domain/gtfs";
import { shortStationName } from "@/features/train-tracker/domain/stations";

/** A stop on a trip, as returned by GTFS `trips/{id}/stops` (in trip order). */
export type TripStop = Pick<Stop, "stop_id" | "stop_code" | "stop_name">;

/**
 * Up to `count` stations the trip calls at before our stop, nearest last,
 * e.g. ["Swanson", "Ranui", "Sturges Rd", "Henderson"]. A trip that starts
 * close to us has fewer. `stopSequence` (1-based, from stoptrips) picks the
 * right call if a trip passes our stop twice; otherwise the first is used.
 * Returns [] if the trip doesn't call at our stop.
 */
export function upstreamStations(
  tripStops: TripStop[],
  stopCode: string,
  stopSequence?: number,
  count = SCENE_STATIONS,
): string[] {
  const bySequence =
    stopSequence != null && tripStops[stopSequence - 1]?.stop_code === stopCode
      ? stopSequence - 1
      : -1;
  const index =
    bySequence >= 0
      ? bySequence
      : tripStops.findIndex((s) => s.stop_code === stopCode);
  if (index <= 0) return [];

  const names: string[] = [];
  for (let i = index - 1; i >= 0 && names.length < count; i--) {
    const name = shortStationName(tripStops[i].stop_name);
    if (names[0] !== name) names.unshift(name);
  }
  return names;
}
