import {
  fixtureNowMs,
  fixtureSchedule,
  fixtureUpdates,
  TRIPS,
} from "@/features/train-tracker/domain/__fixtures__/at-samples";
import {
  type Arrival,
  type Arrivals,
  buildArrivals,
  NO_ARRIVALS,
  pickTrackedTrips,
} from "@/features/train-tracker/domain/arrivals";
import { planCommute } from "@/features/train-tracker/domain/commute";
import { gtfsTimeToMs, MINUTE } from "@/domain/time";

const now = fixtureNowMs; // 23:53:43; next train 00:04 (+9s)
const arrivals = buildArrivals(
  pickTrackedTrips(fixtureSchedule, now),
  fixtureUpdates(),
  now,
);

const plan = (
  at: number,
  a: Arrivals = arrivals,
  pickedTripId?: string,
  walkMinutes = 7,
) =>
  planCommute(at, a, { pickedTripId, walkMinutes, stationName: "Sunnyvale" });

describe("planCommute", () => {
  it("names the destination in the countdown line when there is one", () => {
    const options = { walkMinutes: 7, stationName: "Sunnyvale" };
    expect(
      planCommute(now, arrivals, { ...options, destination: "Britomart" })
        .untilLabel,
    ).toBe("until the 00:04 to Britomart reaches Sunnyvale");
    expect(
      planCommute(now, arrivals, { ...options, destination: "" }).untilLabel,
    ).toBe("until the 00:04 reaches Sunnyvale");
  });

  it("counts down to the next train and says when to leave", () => {
    const p = plan(now, arrivals);
    expect(p).toMatchObject({
      targetTripId: TRIPS.approaching,
      minsLabel: "11 minutes",
      arrivalLabel: "00:04",
      untilLabel: "until the 00:04 reaches Sunnyvale",
      leaveTitle: "Leave in 4 minutes.",
      targetEtaMs: arrivals.next!.etaMs,
      leaveMinutes: 4,
      sceneLabel: "Train 11 minutes away, arrives 00:04",
    });
    expect(p.rows).toEqual([
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
    const p = plan(now, arrivals, TRIPS.stale);
    expect(p.arrivalLabel).toBe("00:12");
    expect(p.rows[0]).toMatchObject({
      tripId: TRIPS.approaching,
      status: "In 11 min",
      tone: "normal",
    });
  });

  it("falls back to the next train when the picked one is gone", () => {
    expect(plan(now, arrivals, "left-ages-ago").targetTripId).toBe(
      TRIPS.approaching,
    );
  });

  it("suggests the next one when it's too late to walk", () => {
    const late = arrivals.next!.etaMs - 3 * MINUTE;
    expect(plan(late, arrivals)).toMatchObject({
      leaveTitle: "Catch the next one.",
      leaveSub: "The 00:12 is on its way.",
    });
  });

  it("describes departed, late and cancelled rows", () => {
    const base = arrivals.next!;
    const row = (a: Partial<Arrival>): Arrival => ({ ...base, ...a });
    const p = plan(now, {
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
      p.rows.map(({ tripId, status, selectable }) => [
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
    expect(plan(eta - 7 * MINUTE, arrivals).leaveMinutes).toBe(0);
    expect(plan(eta - 6 * MINUTE, arrivals).leaveMinutes).toBe(-1);
  });

  it("labels an arriving train", () => {
    expect(plan(arrivals.next!.etaMs + 10_000, arrivals).sceneLabel).toBe(
      "Train arriving now, departs 00:04",
    );
  });

  it("handles no trains at all", () => {
    expect(plan(now, NO_ARRIVALS)).toEqual({
      targetTripId: null,
      minsLabel: "No trains",
      arrivalLabel: null,
      untilLabel: "due in the next two hours",
      leaveTitle: "Nothing to catch.",
      leaveSub: "No trains are due in the next two hours.",
      rows: [],
      targetEtaMs: null,
      leaveMinutes: null,
      sceneLabel: "No trains in the next two hours",
    });
  });

  it("counts back from the walk time in settings", () => {
    expect(plan(now, arrivals, undefined, 2)).toMatchObject({
      leaveTitle: "Leave in 9 minutes.",
      leaveMinutes: 9,
    });
    expect(plan(now, arrivals, undefined, 30)).toMatchObject({
      leaveTitle: "Catch the next one.",
    });
  });

  it("drops trains that have gone when the data is old (offline)", () => {
    const eta = arrivals.next!.etaMs;
    const p = plan(eta + 3 * MINUTE, arrivals);
    expect(p.targetTripId).toBe(TRIPS.stale);
    expect(p.rows[0]).toMatchObject({
      tripId: TRIPS.approaching,
      status: "Left 3 min ago",
      selectable: false,
    });
  });

  describe("with no train in the next two hours", () => {
    const at = gtfsTimeToMs("2026-09-26", "14:00:00");

    it("gives the next train later today", () => {
      const p = plan(at, {
        ...NO_ARRIVALS,
        later: {
          scheduledMs: gtfsTimeToMs("2026-09-26", "16:10:00"),
          nextServiceDay: false,
        },
      });
      expect(p).toMatchObject({
        minsLabel: "No trains",
        untilLabel: "next train at 16:10",
        leaveTitle: "Nothing for a while.",
        leaveSub:
          "No trains are due in the next two hours. The next leaves at 16:10.",
      });
    });

    it("says when there are no more trains today", () => {
      const p = plan(at, {
        ...NO_ARRIVALS,
        later: {
          scheduledMs: gtfsTimeToMs("2026-09-27", "05:34:00"),
          nextServiceDay: true,
        },
      });
      expect(p).toMatchObject({
        untilLabel: "first train at 05:34",
        leaveTitle: "No more trains today.",
        leaveSub: "The first train leaves at 05:34.",
        targetTripId: null,
      });
    });

    it("says so when nothing runs tomorrow morning either", () => {
      expect(plan(at, { ...NO_ARRIVALS, later: null })).toMatchObject({
        untilLabel: "no more today",
        leaveTitle: "No more trains today.",
      });
    });
  });
});
