/**
 * Real AT API responses captured by scripts/at-spike on 2026-09-26: every
 * rail stop plus a few bus stops with similar names, a daytime sample of
 * stoptrips for Sunnyvale's two platforms and Swanson platform 1, and the
 * stops of two trips through Sunnyvale platform 1.
 */
import railStopsJson from "../../../../../scripts/at-spike/samples/fixture-stops-rail-2026-09-26.json";
import stopTrips9320Json from "../../../../../scripts/at-spike/samples/fixture-stoptrips-9320-2026-09-26-h6.json";
import stopTrips9321Json from "../../../../../scripts/at-spike/samples/fixture-stoptrips-9321-2026-09-26-h6.json";
import stopTrips9328Json from "../../../../../scripts/at-spike/samples/fixture-stoptrips-9328-2026-09-26-h6.json";
import manukauTripJson from "../../../../../scripts/at-spike/samples/fixture-tripstops-manukau-2026-09-26.json";
import onehungaTripJson from "../../../../../scripts/at-spike/samples/fixture-tripstops-onehunga-2026-09-26.json";

import type { Stop, StopTrip } from "@/features/train-tracker/domain/gtfs";
import type { TripStop } from "@/features/train-tracker/domain/upstream";

const attributes = <T>(json: { data: { attributes: unknown }[] }) =>
  json.data.map((d) => d.attributes) as T[];

export const fixtureRailStops = attributes<Stop>(railStopsJson);

export const fixturePlatformTrips: Record<string, StopTrip[]> = {
  /** Sunnyvale 1: city-bound, Manukau via City Centre and Onehunga via Grafton. */
  "9320": attributes<StopTrip>(stopTrips9320Json),
  /** Sunnyvale 2: west-bound, Swanson and Henderson. */
  "9321": attributes<StopTrip>(stopTrips9321Json),
  /** Swanson 1: departures to Manukau, plus arrivals that end here (no pickup). */
  "9328": attributes<StopTrip>(stopTrips9328Json),
};

/** Swanson → Manukau via Waitematā: Sunnyvale 1 is the 5th stop. */
export const fixtureManukauTrip = attributes<TripStop>(manukauTripJson);

/** Henderson → Onehunga: Sunnyvale 1 is the 2nd stop. */
export const fixtureOnehungaTrip = attributes<TripStop>(onehungaTripJson);

export function fixtureStop(stopCode: string): Stop {
  const stop = fixtureRailStops.find((s) => s.stop_code === stopCode);
  if (!stop) throw new Error(`No fixture stop ${stopCode}`);
  return stop;
}
