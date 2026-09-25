import { buildArrivals } from "@/features/train-tracker/domain/arrivals";
import type { ArrivalsSource } from "@/features/train-tracker/domain/arrivals-source";
import type { ScheduledTrip } from "@/features/train-tracker/domain/gtfs";
import type { TripUpdate } from "@/features/train-tracker/domain/realtime";
import type { TripStop } from "@/features/train-tracker/domain/upstream";
import { aucklandParts, MINUTE } from "@/domain/time";

const HEADWAY = 15 * MINUTE;
const OUR_STOP_SEQUENCE = 5;
const HEADSIGNS = ["Manukau via City Centre", "Onehunga via Grafton"];
/** Stand-in stations every mock trip calls at before the user's stop. */
const MOCK_UPSTREAM = ["Swanson", "Ranui", "Sturges Rd", "Henderson"];

/**
 * Stand-in timetable: the first train reaches the user's stop 9 minutes
 * after launch, then one every 15 minutes. Anchored at module load so it survives
 * remounts.
 */
const FIRST_ARRIVAL = Date.now() + 9 * MINUTE;

/** The next mock train still to arrive at `nowMs`. */
function nextArrival(nowMs: number): number {
  if (nowMs < FIRST_ARRIVAL) return FIRST_ARRIVAL;
  return (
    FIRST_ARRIVAL +
    (Math.floor((nowMs - FIRST_ARRIVAL) / HEADWAY) + 1) * HEADWAY
  );
}

function mockTrip(scheduledMs: number, stopCode: string): ScheduledTrip {
  const p = aucklandParts(scheduledMs);
  const time = [p.hour, p.minute, p.second]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  const index = Math.round((scheduledMs - FIRST_ARRIVAL) / HEADWAY);
  const headsign = HEADSIGNS[Math.abs(index) % HEADSIGNS.length];
  return {
    trip_id: `mock-${scheduledMs}`,
    route_id: "mock",
    direction_id: 1,
    arrival_time: time,
    departure_time: time,
    stop_id: `mock-${stopCode}`,
    stop_sequence: OUR_STOP_SEQUENCE,
    trip_headsign: headsign,
    stop_headsign: headsign,
    service_date: p.date,
    scheduledMs,
  };
}

/** A fresh update reported at another stop, carrying `delaySec`. */
function mockUpdate(
  trip: ScheduledTrip,
  stopSequence: number,
  delaySec: number,
  nowMs: number,
): TripUpdate {
  return {
    trip: { trip_id: trip.trip_id, schedule_relationship: 0 },
    stop_time_update: {
      stop_sequence: stopSequence,
      departure: { delay: delaySec },
    },
    timestamp: Math.floor(nowMs / 1000),
    delay: delaySec,
  };
}

/**
 * Emits the same Arrivals as the live source by running mock trips and
 * updates through the real domain logic: the previous train has left, the
 * next is live and on time, the one after is 2 min late, and the rest are
 * timetable-only.
 */
export function createMockArrivalsSource(stopCode: string): ArrivalsSource {
  return {
    async getArrivals(nowMs) {
      const arrival = nextArrival(nowMs);
      const [gone, next, late, ...later] = [
        arrival - 11 * MINUTE,
        arrival,
        arrival + HEADWAY,
        arrival + 2 * HEADWAY,
        arrival + 3 * HEADWAY,
      ].map((ms) => mockTrip(ms, stopCode));

      const updates = new Map<string, TripUpdate>([
        [gone.trip_id, mockUpdate(gone, OUR_STOP_SEQUENCE + 3, 0, nowMs)],
        [next.trip_id, mockUpdate(next, OUR_STOP_SEQUENCE - 3, 0, nowMs)],
        [late.trip_id, mockUpdate(late, 1, 120, nowMs)],
      ]);
      return buildArrivals([gone, next, late, ...later], updates, nowMs);
    },

    async getTripStops() {
      const stops: TripStop[] = MOCK_UPSTREAM.map((name, i) => ({
        stop_id: `mock-up-${i}`,
        stop_code: `mock-up-${i}`,
        stop_name: `${name} Train Station 1`,
      }));
      return [
        ...stops,
        { stop_id: `mock-${stopCode}`, stop_code: stopCode, stop_name: "You" },
      ];
    },
  };
}
