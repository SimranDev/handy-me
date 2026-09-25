import {
  fixtureSchedule,
  fixtureStopTrips,
} from "@/features/train-tracker/domain/__fixtures__/at-samples";
import {
  mergeSchedules,
  stopTripQueries,
} from "@/features/train-tracker/domain/gtfs";
import { MINUTE } from "@/domain/time";

const at = (iso: string) => Date.parse(iso);

describe("stopTripQueries", () => {
  it("queries from 20 minutes ago on the current service date", () => {
    expect(stopTripQueries(at("2026-09-25T18:30:00+12:00"))).toEqual([
      { date: "2026-09-25", startHour: 18, hourRange: 4 },
    ]);
  });

  it("just after midnight, keeps using the previous service day (24:xx times)", () => {
    expect(stopTripQueries(at("2026-09-26T00:10:00+12:00"))).toEqual([
      { date: "2026-09-25", startHour: 23, hourRange: 4 },
    ]);
  });

  it("in the early hours, adds the previous day with start_hour = hour + 24", () => {
    expect(stopTripQueries(at("2026-09-26T00:40:00+12:00"))).toEqual([
      { date: "2026-09-26", startHour: 1, hourRange: 4 },
      { date: "2026-09-25", startHour: 24, hourRange: 4 },
    ]);
  });

  it("never sends start_hour=0, which AT rejects", () => {
    const start = at("2026-09-25T00:00:00+12:00");
    for (let t = start; t < start + 24 * 60 * MINUTE; t += 5 * MINUTE) {
      for (const q of stopTripQueries(t))
        expect(q.startHour).toBeGreaterThan(0);
    }
  });
});

describe("mergeSchedules", () => {
  it("orders trips by departure, with 24:xx after 23:xx", () => {
    expect(fixtureSchedule.map((t) => t.departure_time)).toEqual([
      "23:04:00",
      "23:12:00",
      "23:34:00",
      "23:42:00",
      "24:04:00",
      "24:12:00",
      "24:34:00",
      "24:41:00",
    ]);
    expect(fixtureSchedule[4].scheduledMs).toBe(
      at("2026-09-26T00:04:00+12:00"),
    );
  });

  it("drops duplicate trips returned by overlapping queries", () => {
    const merged = mergeSchedules([
      fixtureStopTrips,
      fixtureStopTrips.slice(2),
    ]);
    expect(merged).toHaveLength(fixtureStopTrips.length);
  });
});
