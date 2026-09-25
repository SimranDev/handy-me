import {
  fixtureNowMs,
  fixtureSchedule,
  fixtureUpdates,
  TRIPS,
} from "@/features/train-tracker/domain/__fixtures__/at-samples";
import {
  type Arrival,
  buildArrivals,
  NO_ARRIVALS,
  pickTrackedTrips,
} from "@/features/train-tracker/domain/arrivals";
import { planCommute } from "@/features/train-tracker/domain/commute";
import { MINUTE } from "@/domain/time";

const now = fixtureNowMs; // 23:53:43; next train 00:04 (+9s)
const arrivals = buildArrivals(
  pickTrackedTrips(fixtureSchedule, now),
  fixtureUpdates(),
  now,
);

describe("planCommute", () => {
  it("counts down to the next train and says when to leave", () => {
    const plan = planCommute(now, arrivals);
    expect(plan).toMatchObject({
      targetTripId: TRIPS.approaching,
      minsLabel: "11 minutes",
      arrivalLabel: "00:04",
      leaveTitle: "Leave in 4 minutes.",
      targetEtaMs: arrivals.next!.etaMs,
      leaveMinutes: 4,
      sceneLabel: "Train 11 minutes away, arrives 00:04",
    });
    expect(plan.rows).toEqual([
      {
        tripId: TRIPS.stale,
        time: "00:12",
        status: "Scheduled",
        tone: "muted",
        selectable: true,
      },
      {
        tripId: TRIPS.laterNoRealtime,
        time: "00:34",
        status: "Scheduled",
        tone: "muted",
        selectable: true,
      },
    ]);
  });

  it("plans around a picked later train", () => {
    const plan = planCommute(now, arrivals, TRIPS.stale);
    expect(plan.arrivalLabel).toBe("00:12");
    expect(plan.rows[0]).toMatchObject({
      tripId: TRIPS.approaching,
      status: "In 11 min",
      tone: "normal",
    });
  });

  it("falls back to the next train when the picked one is gone", () => {
    expect(planCommute(now, arrivals, "left-ages-ago").targetTripId).toBe(
      TRIPS.approaching,
    );
  });

  it("suggests the next one when it's too late to walk", () => {
    const late = arrivals.next!.etaMs - 3 * MINUTE;
    expect(planCommute(late, arrivals)).toMatchObject({
      leaveTitle: "Catch the next one.",
      leaveSub: "The 00:12 is on its way.",
    });
  });

  it("describes departed, late and cancelled rows", () => {
    const base = arrivals.next!;
    const row = (a: Partial<Arrival>): Arrival => ({ ...base, ...a });
    const plan = planCommute(now, {
      justDeparted: row({
        tripId: "gone",
        etaMs: now - 3 * MINUTE,
        scheduledMs: now - 4 * MINUTE,
      }),
      next: base,
      afterNext: [
        row({ tripId: "late", status: { kind: "late", minutes: 2 } }),
        row({ tripId: "cancelled", status: { kind: "cancelled" } }),
      ],
    });
    expect(
      plan.rows.map(({ tripId, status, selectable }) => [
        tripId,
        status,
        selectable,
      ]),
    ).toEqual([
      ["gone", "Left 3 min ago", false],
      ["late", "Running 2 min late", true],
      ["cancelled", "Cancelled", false],
    ]);
  });

  it("counts leave minutes down through zero", () => {
    const eta = arrivals.next!.etaMs;
    expect(planCommute(eta - 7 * MINUTE, arrivals).leaveMinutes).toBe(0);
    expect(planCommute(eta - 6 * MINUTE, arrivals).leaveMinutes).toBe(-1);
  });

  it("labels an arriving train", () => {
    expect(
      planCommute(arrivals.next!.etaMs + 10_000, arrivals).sceneLabel,
    ).toBe("Train arriving now, departs 00:04");
  });

  it("handles no trains at all", () => {
    expect(planCommute(now, NO_ARRIVALS)).toEqual({
      targetTripId: null,
      minsLabel: "No trains",
      arrivalLabel: null,
      leaveTitle: "Nothing to catch.",
      leaveSub: "No trains are due in the next two hours.",
      rows: [],
      targetEtaMs: null,
      leaveMinutes: null,
      sceneLabel: "No trains in the next two hours",
    });
  });
});
