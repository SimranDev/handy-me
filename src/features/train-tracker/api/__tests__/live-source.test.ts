import {
  fetchStopByCode,
  fetchStopTrips,
  fetchTripUpdates,
} from "@/features/train-tracker/api/at-api";
import { createLiveArrivalsSource } from "@/features/train-tracker/api/live-source";
import {
  fixturePlatformTrips,
  fixtureStop,
} from "@/features/train-tracker/domain/__fixtures__/station-samples";
import type { StopTripQuery } from "@/features/train-tracker/domain/gtfs";
import { gtfsTimeToMs, MINUTE } from "@/domain/time";

jest.mock("@/features/train-tracker/api/at-api", () => ({
  fetchStopByCode: jest.fn(),
  fetchStopTrips: jest.fn(),
  fetchTripStops: jest.fn(),
  fetchTripUpdates: jest.fn(),
}));

const stopByCode = jest.mocked(fetchStopByCode);
const stopTrips = jest.mocked(fetchStopTrips);
const tripUpdates = jest.mocked(fetchTripUpdates);

beforeEach(() => {
  jest.resetAllMocks();
  stopByCode.mockImplementation(async (code) => fixtureStop(code));
  tripUpdates.mockResolvedValue(new Map());
});

// The fixture's trips at Sunnyvale 1 run 06:04–07:04 on Saturday 2026-09-26.
const sunnyvale1 = fixturePlatformTrips["9320"];

it("tracks only the chosen platform's boardable trips", async () => {
  // Swanson 1 mixes departures with arrivals that end there.
  stopTrips.mockResolvedValue(fixturePlatformTrips["9328"]);
  const source = createLiveArrivalsSource({
    stopCode: "9328",
    directionId: null,
  });
  const arrivals = await source.getArrivals(
    gtfsTimeToMs("2026-09-26", "05:50:00"),
  );

  const listed = [arrivals.next, ...arrivals.afterNext];
  expect(listed.length).toBeGreaterThan(0);
  expect(listed.every((a) => a?.headsign === "Manukau via City Centre")).toBe(
    true,
  );
});

it("filters to the chosen direction", async () => {
  stopTrips.mockResolvedValue([...sunnyvale1, ...fixturePlatformTrips["9321"]]);
  const source = createLiveArrivalsSource({ stopCode: "9320", directionId: 0 });
  const arrivals = await source.getArrivals(
    gtfsTimeToMs("2026-09-26", "05:50:00"),
  );
  expect(arrivals.next?.headsign).toMatch(/Swanson|Henderson/);
});

describe("after the last train", () => {
  const night = gtfsTimeToMs("2026-09-26", "23:30:00");
  const firstTomorrow = gtfsTimeToMs("2026-09-27", "05:04:00");
  const tomorrowTrips = sunnyvale1.map((t) => ({
    ...t,
    service_date: "2026-09-27",
    departure_time: "05:04:00",
  }));

  beforeEach(() => {
    // AT's 404 for an empty window reaches the source as [].
    stopTrips.mockImplementation(async (_id, q: StopTripQuery) =>
      q.date === "2026-09-27" ? tomorrowTrips.slice(0, 1) : [],
    );
  });

  it("says when the first train of the next day leaves", async () => {
    const source = createLiveArrivalsSource({
      stopCode: "9320",
      directionId: null,
    });
    const arrivals = await source.getArrivals(night);

    expect(arrivals.next).toBeNull();
    expect(arrivals.later).toEqual({
      scheduledMs: firstTomorrow,
      nextServiceDay: true,
    });
    expect(tripUpdates).toHaveBeenCalledWith([], undefined);
  });

  it("caches the lookup and re-resolves the stop in case its id went stale", async () => {
    const source = createLiveArrivalsSource({
      stopCode: "9320",
      directionId: null,
    });
    await source.getArrivals(night);
    const calls = stopTrips.mock.calls.length;

    await source.getArrivals(night + MINUTE);
    // The timetable and the later train are cached for 10 minutes…
    expect(stopTrips.mock.calls.length).toBe(calls);
    await source.getArrivals(night + 11 * MINUTE);
    // …and the empty timetable made it look the stop up again.
    expect(stopByCode).toHaveBeenCalledTimes(2);
  });
});
