/**
 * Step 1: find the rail station named STATION_NAME and list its platforms,
 * with the directions each one serves, so you can pick your city-bound stop_code.
 *
 *   pnpm stations
 */
import { callCount, requireEnv } from "./at.ts";
import { aucklandParts, getStops, getStopTrips, RAIL, STATION, type Stop } from "./gtfs.ts";

// A daytime window gives a representative mix of services whatever the time now.
const SAMPLE_START_HOUR = 6;
const SAMPLE_HOUR_RANGE = 12;

const name = requireEnv("STATION_NAME");
const { date } = aucklandParts(Date.now());

const stops = await getStops(date, `stops-${date}`);
const rail = stops.filter((s) => s.vehicle_type === RAIL);
const stations = rail.filter(
  (s) => s.location_type === STATION && s.stop_name.toLowerCase().includes(name.toLowerCase()),
);

if (stations.length === 0) {
  const all = rail.filter((s) => s.location_type === STATION).map((s) => s.stop_name);
  console.error(`No rail station matching "${name}". Rail stations on ${date}:`);
  console.error(all.sort().map((n) => `  ${n}`).join("\n"));
  process.exit(1);
}

for (const station of stations) {
  console.log(`\n${station.stop_name}  (stop_code ${station.stop_code}, stop_id ${station.stop_id})`);
  const platforms = rail
    .filter((s) => s.parent_station === station.stop_id)
    .sort((a, b) => (a.platform_code ?? "").localeCompare(b.platform_code ?? "", "en", { numeric: true }));

  if (platforms.length === 0) {
    console.log("  (no child platform stops)");
    continue;
  }
  for (const platform of platforms) await describePlatform(platform);
}

console.log(`\nPick the city-bound platform's stop_code and run:  pnpm watch <stop_code>`);
console.log(`(${callCount()} AT API calls)`);

async function describePlatform(platform: Stop) {
  const trips = await getStopTrips(
    platform.stop_id,
    date,
    SAMPLE_START_HOUR,
    SAMPLE_HOUR_RANGE,
    `stoptrips-${platform.stop_code}-${date}-h${SAMPLE_START_HOUR}`,
  );
  console.log(`\n  Platform ${platform.platform_code ?? "?"}  stop_code ${platform.stop_code}  (${platform.stop_name})`);
  if (trips.length === 0) {
    console.log(`    no trips ${SAMPLE_START_HOUR}:00–${SAMPLE_START_HOUR + SAMPLE_HOUR_RANGE}:00 today`);
    return;
  }

  const services = new Map<string, { direction: number; stopHeadsign: string; tripHeadsign: string; count: number }>();
  for (const t of trips) {
    const key = `${t.direction_id}|${t.stop_headsign ?? ""}|${t.trip_headsign}`;
    const entry = services.get(key) ?? {
      direction: t.direction_id,
      stopHeadsign: t.stop_headsign ?? "",
      tripHeadsign: t.trip_headsign,
      count: 0,
    };
    entry.count++;
    services.set(key, entry);
  }
  for (const s of [...services.values()].sort((a, b) => b.count - a.count)) {
    console.log(
      `    direction ${s.direction}  ${String(s.count).padStart(3)} trips  ${s.stopHeadsign || "-"}   [${s.tripHeadsign}]`,
    );
  }
}
