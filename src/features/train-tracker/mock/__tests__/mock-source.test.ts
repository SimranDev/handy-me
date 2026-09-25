import { upstreamStations } from "@/features/train-tracker/domain/upstream";
import { createMockArrivalsSource } from "@/features/train-tracker/mock/mock-source";

it("emits the same Arrivals shape as the live source", async () => {
  const now = Date.now();
  const arrivals = await createMockArrivalsSource("9320").getArrivals(now);

  expect(arrivals.next).toMatchObject({
    source: "live",
    status: { kind: "on-time" },
  });
  expect(arrivals.next!.etaMs).toBeGreaterThan(now);
  expect(arrivals.afterNext[0]).toMatchObject({
    source: "live",
    status: { kind: "late", minutes: 2 },
  });
  expect(arrivals.afterNext.slice(1).map((a) => a.source)).toEqual([
    "scheduled",
    "scheduled",
  ]);
});

it("draws four stations before the user's stop", async () => {
  const source = createMockArrivalsSource("9320");
  const { next } = await source.getArrivals(Date.now());
  const stops = await source.getTripStops(next!.tripId, next!.serviceDate);
  expect(upstreamStations(stops, "9320", next!.stopSequence)).toHaveLength(4);
});
