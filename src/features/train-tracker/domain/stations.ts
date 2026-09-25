import {
  boardableTrips,
  RAIL,
  STATION,
  type Stop,
  type StopTrip,
} from "@/features/train-tracker/domain/gtfs";

/** A rail station and the platforms you can board at. */
export type RailStation = {
  /** Short name, e.g. "Sunnyvale". */
  name: string;
  /** Today's id of the station stop; changes with GTFS versions, never store it. */
  stopId: string;
  platforms: Stop[];
};

/** One direction served by one platform: what the user picks. */
export type PlatformDirection = {
  /** Stable across GTFS versions: the value to store. */
  stopCode: string;
  platformCode: string | null;
  /** null when no trips were found to tell. */
  directionId: number | null;
  /** Headsigns in this direction, most frequent first. */
  headsigns: string[];
  tripCount: number;
};

/**
 * "Sunnyvale Train Station 1" → "Sunnyvale". Names without the suffix
 * ("Hamilton Frankton") are kept as they are.
 */
export function shortStationName(name: string): string {
  return name.replace(/\s+train station(\s+\d+)?$/i, "").trim() || name;
}

/**
 * Rail stations (vehicle_type 2) with their platforms, sorted by name. A rail
 * platform with no parent station counts as a station of its own.
 */
export function railStations(stops: Stop[]): RailStation[] {
  const rail = stops.filter((s) => s.vehicle_type === RAIL);
  const byParent = new Map<string, Stop[]>();
  for (const s of rail) {
    if (s.location_type === STATION || !s.parent_station) continue;
    byParent.set(s.parent_station, [
      ...(byParent.get(s.parent_station) ?? []),
      s,
    ]);
  }

  const stations: RailStation[] = [];
  for (const s of rail) {
    if (s.location_type === STATION) {
      const platforms = (byParent.get(s.stop_id) ?? []).sort(byPlatform);
      if (platforms.length > 0) {
        stations.push({
          name: shortStationName(s.stop_name),
          stopId: s.stop_id,
          platforms,
        });
      }
    } else if (!s.parent_station) {
      stations.push({
        name: shortStationName(s.stop_name),
        stopId: s.stop_id,
        platforms: [s],
      });
    }
  }
  return stations.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

function byPlatform(a: Stop, b: Stop): number {
  return (a.platform_code ?? "").localeCompare(b.platform_code ?? "", "en", {
    numeric: true,
  });
}

/** Lower-case, no accents or macrons, single spaces. */
function normalise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Stations whose name matches `query`: names starting with it first, then a
 * word starting with it, then anywhere. An empty query returns them all.
 */
export function searchStations(
  stations: RailStation[],
  query: string,
): RailStation[] {
  const q = normalise(query);
  if (!q) return stations;

  const rank = (station: RailStation) => {
    const name = normalise(station.name);
    if (name.startsWith(q)) return 0;
    if (name.includes(` ${q}`)) return 1;
    if (name.includes(q)) return 2;
    return -1;
  };
  return stations
    .map((station) => ({ station, rank: rank(station) }))
    .filter((r) => r.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((r) => r.station);
}

/**
 * The directions a platform serves, from a sample of its stoptrips. Trips
 * that end here (no pickup) are left out, as you can't board them. A
 * platform with no trips in the sample gets one entry with an unknown
 * direction, so it can still be picked.
 */
export function platformDirections(
  platform: Stop,
  trips: StopTrip[],
): PlatformDirection[] {
  const base = {
    stopCode: platform.stop_code,
    platformCode: platform.platform_code ?? null,
  };
  const byDirection = new Map<number, Map<string, number>>();
  for (const t of boardableTrips(trips, null)) {
    const headsign = (t.stop_headsign || t.trip_headsign).trim();
    const counts = byDirection.get(t.direction_id) ?? new Map();
    counts.set(headsign, (counts.get(headsign) ?? 0) + 1);
    byDirection.set(t.direction_id, counts);
  }
  if (byDirection.size === 0) {
    return [{ ...base, directionId: null, headsigns: [], tripCount: 0 }];
  }

  return [...byDirection]
    .map(([directionId, counts]) => {
      const sorted = [...counts].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"),
      );
      return {
        ...base,
        directionId,
        headsigns: sorted.map(([h]) => h),
        tripCount: sorted.reduce((n, [, c]) => n + c, 0),
      };
    })
    .sort((a, b) => b.tripCount - a.tripCount);
}

/** e.g. "towards Manukau via City Centre or Onehunga via Grafton". */
export function directionLabel(direction: PlatformDirection): string {
  const { headsigns } = direction;
  if (headsigns.length === 0) return "No trains found today";
  const last = headsigns.at(-1);
  const places =
    headsigns.length === 1
      ? last
      : `${headsigns.slice(0, -1).join(", ")} or ${last}`;
  return `towards ${places}`;
}

/** The default destination label: the direction's most frequent headsign. */
export function deriveDestinationLabel(direction: PlatformDirection): string {
  return direction.headsigns[0] ?? "";
}
