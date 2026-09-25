import {
  fixtureNowMs,
  fixtureSchedule,
  fixtureUpdates,
  scheduledTrip,
  TRIPS,
} from "@/features/train-tracker/domain/__fixtures__/at-samples";
import {
  buildArrivals,
  estimateArrival,
  pickLaterTrain,
  pickTrackedTrips,
} from "@/features/train-tracker/domain/arrivals";
import type { TripUpdate } from "@/features/train-tracker/domain/realtime";
import { MINUTE } from "@/domain/time";

const now = fixtureNowMs; // 2026-09-25 23:53:43 NZST

function update(tripId: string): TripUpdate {
  const u = fixtureUpdates().get(tripId);
  if (!u) throw new Error(`No fixture update for ${tripId}`);
  return u;
}

describe("pickTrackedTrips", () => {
  it("tracks the last two scheduled before now and the next three", () => {
    expect(
      pickTrackedTrips(fixtureSchedule, now).map((t) => t.trip_id),
    ).toEqual([
      TRIPS.passed,
      TRIPS.departedNoRealtime,
      TRIPS.approaching,
      TRIPS.stale,
      TRIPS.laterNoRealtime,
    ]);
  });
});

describe("buildArrivals with the captured snapshot", () => {
  const arrivals = buildArrivals(
    pickTrackedTrips(fixtureSchedule, now),
    fixtureUpdates(),
    now,
  );

  it("uses the approaching train's live delay for next", () => {
    const trip = scheduledTrip(TRIPS.approaching);
    expect(arrivals.next).toEqual({
      tripId: TRIPS.approaching,
      serviceDate: "2026-09-25",
      stopSequence: 5,
      headsign: "Manukau via City Centre",
      scheduledMs: trip.scheduledMs,
      etaMs: trip.scheduledMs + 9_000, // trip-level delay, not the stop's 21s
      source: "live",
      status: { kind: "on-time" },
    });
  });

  it("treats the ~15h old placeholder as scheduled, not live", () => {
    expect(arrivals.afterNext.map((a) => [a.tripId, a.source])).toEqual([
      [TRIPS.stale, "scheduled"],
      [TRIPS.laterNoRealtime, "scheduled"],
    ]);
  });

  it("reports no just-departed train when the last left over 5 min ago", () => {
    expect(arrivals.justDeparted).toBeNull();
  });
});

describe("estimateArrival", () => {
  it("marks a train whose latest update is past our stop as departed", () => {
    const { arrival, departed } = estimateArrival(
      scheduledTrip(TRIPS.passed),
      update(TRIPS.passed),
      now,
    );
    expect(departed).toBe(true);
    expect(arrival.source).toBe("live");
    expect(arrival.status).toEqual({ kind: "late", minutes: 2 }); // 97s
  });

  it("prefers an update for our own stop", () => {
    const trip = scheduledTrip(TRIPS.approaching);
    const u = update(TRIPS.approaching);
    const departsAt = trip.scheduledMs / 1000 + 130;
    u.stop_time_update = {
      stop_sequence: trip.stop_sequence,
      stop_id: trip.stop_id,
      departure: { delay: 130, time: departsAt },
    };
    const { arrival, departed } = estimateArrival(trip, u, now);
    expect(arrival.etaMs).toBe(departsAt * 1000);
    expect(arrival.status).toEqual({ kind: "late", minutes: 2 });
    expect(departed).toBe(false);
  });

  it("gives the same answer when stop_time_update is an array with future stops", () => {
    const trip = scheduledTrip(TRIPS.approaching);
    const mine = {
      stop_sequence: trip.stop_sequence,
      stop_id: trip.stop_id,
      departure: { delay: 130, time: trip.scheduledMs / 1000 + 130 },
    };
    const asObject = update(TRIPS.approaching);
    asObject.stop_time_update = mine;
    const asArray = update(TRIPS.approaching);
    asArray.stop_time_update = [
      { stop_sequence: trip.stop_sequence - 1, departure: { delay: 120 } },
      mine,
      { stop_sequence: trip.stop_sequence + 1, arrival: { delay: 140 } },
    ];
    expect(estimateArrival(trip, asArray, now)).toEqual(
      estimateArrival(trip, asObject, now),
    );
  });

  it("uses a delay-only event at our stop", () => {
    const trip = scheduledTrip(TRIPS.approaching);
    const u = update(TRIPS.approaching);
    u.stop_time_update = {
      stop_sequence: trip.stop_sequence,
      arrival: { delay: -20 },
    };
    const { arrival } = estimateArrival(trip, u, now);
    expect(arrival.etaMs).toBe(trip.scheduledMs - 20_000);
    expect(arrival.status).toEqual({ kind: "on-time" }); // early counts as on time
  });

  it("counts realtime as fresh for exactly 15 minutes", () => {
    const trip = scheduledTrip(TRIPS.approaching);
    const u = update(TRIPS.approaching);
    u.timestamp = (now - 15 * MINUTE) / 1000;
    expect(estimateArrival(trip, u, now).arrival.source).toBe("live");
    u.timestamp -= 1;
    expect(estimateArrival(trip, u, now).arrival.source).toBe("scheduled");
  });

  it("falls back to the timetable with no realtime", () => {
    const trip = scheduledTrip(TRIPS.laterNoRealtime);
    const { arrival, departed } = estimateArrival(trip, undefined, now);
    expect(arrival).toMatchObject({
      etaMs: trip.scheduledMs,
      source: "scheduled",
      status: { kind: "on-time" },
    });
    expect(departed).toBe(false);
  });
});

describe("cancellations", () => {
  const tracked = pickTrackedTrips(fixtureSchedule, now);

  it("skips a cancelled trip for next but still lists it", () => {
    const updates = fixtureUpdates();
    updates.get(TRIPS.approaching)!.trip.schedule_relationship = 3;
    const arrivals = buildArrivals(tracked, updates, now);
    expect(arrivals.next?.tripId).toBe(TRIPS.stale);
    expect(arrivals.afterNext[0]).toMatchObject({
      tripId: TRIPS.approaching,
      status: { kind: "cancelled" },
    });
  });

  it("treats a skipped stop as cancelled for us", () => {
    const trip = scheduledTrip(TRIPS.approaching);
    const u = update(TRIPS.approaching);
    u.stop_time_update = {
      stop_sequence: trip.stop_sequence,
      schedule_relationship: 1,
    };
    expect(estimateArrival(trip, u, now).arrival.status).toEqual({
      kind: "cancelled",
    });
  });
});

describe("justDeparted", () => {
  it("is the latest train to leave within the last 5 minutes", () => {
    const at = scheduledTrip(TRIPS.passed).scheduledMs + 4 * MINUTE; // 23:38
    const arrivals = buildArrivals(
      pickTrackedTrips(fixtureSchedule, at),
      fixtureUpdates(),
      at,
    );
    expect(arrivals.justDeparted).toMatchObject({
      tripId: TRIPS.passed,
      etaMs: scheduledTrip(TRIPS.passed).scheduledMs + 97_000,
    });
    expect(arrivals.next?.tripId).toBe(TRIPS.departedNoRealtime);
  });
});

describe("pickLaterTrain", () => {
  const trips = fixtureSchedule; // 23:04 … 24:34 on 2026-09-25
  const tracked = new Set([TRIPS.approaching]);

  it("finds the first untracked train after now", () => {
    expect(
      pickLaterTrain([{ trips, nextServiceDay: false }], fixtureNowMs, tracked),
    ).toEqual({
      scheduledMs: scheduledTrip(TRIPS.stale).scheduledMs,
      nextServiceDay: false,
    });
  });

  it("moves on to the next service day when today has none left", () => {
    const afterLast = Math.max(...trips.map((t) => t.scheduledMs)) + 1;
    expect(
      pickLaterTrain(
        [
          { trips, nextServiceDay: false },
          { trips: fixtureSchedule.slice(0, 1), nextServiceDay: true },
        ],
        afterLast,
        tracked,
      ),
    ).toBeNull();
    expect(
      pickLaterTrain(
        [
          { trips: [], nextServiceDay: false },
          { trips, nextServiceDay: true },
        ],
        fixtureNowMs,
        tracked,
      ),
    ).toMatchObject({ nextServiceDay: true });
  });
});
