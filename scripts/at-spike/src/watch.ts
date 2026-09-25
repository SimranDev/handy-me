/**
 * Steps 2–4: live departures from one platform, refreshed every 30s.
 *
 *   pnpm watch <stop_code> [--once]
 */
import { setTimeout as sleep } from "node:timers/promises";

import { callCount } from "./at.ts";
import { type Eta, estimate } from "./eta.ts";
import {
  aucklandParts,
  getStops,
  getStopTrips,
  previousDate,
  type ScheduledTrip,
  type Stop,
} from "./gtfs.ts";
import { getTripUpdates } from "./realtime.ts";

const MINUTE = 60_000;
const TICK_MS = 30_000;
const LOOKAHEAD_MS = 120 * MINUTE;
/** How far back to keep trips, so late-running and just-departed trains stay visible. */
const LOOKBACK_MS = 20 * MINUTE;
const JUST_DEPARTED_MS = 5 * MINUTE;
const SCHEDULE_TTL_MS = 10 * MINUTE;
const UPCOMING_TRACKED = 3;
const PAST_TRACKED = 2;

const [stopCode, ...flags] = process.argv.slice(2);
if (!stopCode || !/^\d+$/.test(stopCode)) {
  console.error("Usage: pnpm watch <platform stop_code> [--once]   (find it with: pnpm stations)");
  process.exit(1);
}
const once = flags.includes("--once");

let stop: Stop | undefined;
let stopDate = "";
let schedule: ScheduledTrip[] = [];
let scheduleLoadedAt = 0;

process.on("SIGINT", () => {
  console.log(`\nStopped after ${callCount()} AT API calls.`);
  process.exit(0);
});

while (true) {
  try {
    await tick(Date.now());
  } catch (err) {
    console.error(`[${aucklandParts(Date.now()).clockSeconds}] ${(err as Error).message}`);
  }
  if (once) break;
  await sleep(TICK_MS);
}

async function tick(now: number) {
  const { date } = aucklandParts(now);

  // stop_id carries a GTFS version hash, so resolve it from stop_code for each service day.
  if (!stop || stopDate !== date) {
    stop = await resolveStop(stopCode, date);
    stopDate = date;
    scheduleLoadedAt = 0;
  }
  if (now - scheduleLoadedAt > SCHEDULE_TTL_MS) {
    schedule = await loadSchedule(stop, now);
    scheduleLoadedAt = now;
  }

  const window = schedule.filter(
    (t) => t.scheduledMs >= now - LOOKBACK_MS && t.scheduledMs <= now + LOOKAHEAD_MS,
  );
  const tracked = [
    ...window.filter((t) => t.scheduledMs < now).slice(-PAST_TRACKED),
    ...window.filter((t) => t.scheduledMs >= now).slice(0, UPCOMING_TRACKED),
  ];

  const stamp = aucklandParts(now);
  const updates = await getTripUpdates(
    tracked.map((t) => t.trip_id),
    `tripupdates-${stamp.date}T${stamp.clockSeconds.replaceAll(":", "")}`,
  );
  const etas = tracked.map((t) => estimate(t, updates.get(t.trip_id), now));

  const justDeparted = etas
    .filter((e) => e.departed && !e.cancelled && e.etaMs >= now - JUST_DEPARTED_MS)
    .at(-1);
  const upcoming = etas.filter((e) => !e.departed && !e.cancelled).sort((a, b) => a.etaMs - b.etaMs);
  const cancelled = etas.filter((e) => e.cancelled && e.trip.scheduledMs >= now - JUST_DEPARTED_MS);

  console.log(
    `\n[${stamp.clockSeconds}] ${stop.stop_name} · ${stop.stop_code} · ` +
      `${updates.size}/${tracked.length} trips with realtime · ${callCount()} calls`,
  );
  printRow("just departed", justDeparted, now);
  printRow("next", upcoming[0], now);
  printRow("after next", upcoming[1], now);
  for (const e of cancelled) printRow("cancelled", e, now);
}

async function resolveStop(code: string, date: string): Promise<Stop> {
  const stops = await getStops(date, `stops-${date}`);
  const found = stops.find((s) => s.stop_code === code);
  if (!found) throw new Error(`No stop with stop_code ${code} on ${date}.`);
  console.log(`Resolved stop_code ${code} → ${found.stop_id} (${found.stop_name}) for ${date}`);
  return found;
}

/**
 * Stoptrips from LOOKBACK before now to at least LOOKAHEAD after. After
 * midnight the previous service day also runs (times like 24:30), and AT
 * rejects start_hour=0, so that day is queried with start_hour = hour + 24.
 */
async function loadSchedule(s: Stop, now: number): Promise<ScheduledTrip[]> {
  const from = aucklandParts(now - LOOKBACK_MS);
  const hourRange = Math.ceil((LOOKBACK_MS + LOOKAHEAD_MS) / (60 * MINUTE)) + 1;
  const queries: { date: string; startHour: number }[] = [
    { date: from.date, startHour: Math.max(from.hour, 1) },
  ];
  if (from.hour < 4) queries.push({ date: previousDate(from.date), startHour: from.hour + 24 });

  const trips = new Map<string, ScheduledTrip>();
  for (const q of queries) {
    const batch = await getStopTrips(
      s.stop_id,
      q.date,
      q.startHour,
      hourRange,
      `stoptrips-${s.stop_code}-${q.date}-h${q.startHour}`,
    );
    for (const t of batch) trips.set(`${t.service_date}|${t.trip_id}`, t);
  }
  return [...trips.values()].sort((a, b) => a.scheduledMs - b.scheduledMs);
}

function printRow(label: string, e: Eta | undefined, now: number) {
  if (!e) {
    if (label === "next" || label === "after next") console.log(`  ${label.padEnd(14)} —`);
    return;
  }
  const mins = Math.floor((e.etaMs - now) / MINUTE);
  const when = e.cancelled
    ? "CANCELLED"
    : e.departed
      ? `${Math.max(0, -mins - 1)} min ago`
      : mins < 1
        ? "due"
        : `in ${mins} min`;
  const delay = e.delaySec != null ? formatDelay(e.delaySec) : "";
  const scheduledNote =
    e.source === "live" && aucklandParts(e.trip.scheduledMs).clock !== aucklandParts(e.etaMs).clock
      ? ` (sched ${aucklandParts(e.trip.scheduledMs).clock})`
      : "";
  console.log(
    `  ${label.padEnd(14)} ${aucklandParts(e.etaMs).clock}  ${when.padEnd(11)} ` +
      `${e.source.padEnd(9)} ${delay.padEnd(7)} ${e.trip.stop_headsign ?? e.trip.trip_headsign}` +
      `${scheduledNote}  · ${e.basis}`,
  );
}

function formatDelay(sec: number): string {
  const sign = sec < 0 ? "-" : "+";
  const abs = Math.abs(sec);
  return abs < 60 ? `${sign}${abs}s` : `${sign}${Math.floor(abs / 60)}m${String(abs % 60).padStart(2, "0")}s`;
}
