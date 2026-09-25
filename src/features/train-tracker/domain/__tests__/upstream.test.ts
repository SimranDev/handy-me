import {
  fixtureManukauTrip,
  fixtureOnehungaTrip,
} from "@/features/train-tracker/domain/__fixtures__/station-samples";
import { upstreamStations } from "@/features/train-tracker/domain/upstream";

describe("upstreamStations", () => {
  it("gives the four stations before ours, nearest last", () => {
    expect(upstreamStations(fixtureManukauTrip, "9320", 5)).toEqual([
      "Swanson",
      "Ranui",
      "Sturges Rd",
      "Henderson",
    ]);
  });

  it("finds our stop by stop_code when the sequence isn't known", () => {
    expect(upstreamStations(fixtureManukauTrip, "9320")).toEqual([
      "Swanson",
      "Ranui",
      "Sturges Rd",
      "Henderson",
    ]);
  });

  it("gives fewer for a trip that starts close by", () => {
    expect(upstreamStations(fixtureOnehungaTrip, "9320", 2)).toEqual([
      "Henderson",
    ]);
  });

  it("takes only the nearest stations further along the line", () => {
    const waitemata = fixtureManukauTrip.find((s) =>
      s.stop_name.startsWith("Waitemata"),
    )!;
    expect(upstreamStations(fixtureManukauTrip, waitemata.stop_code)).toEqual([
      "Kingsland",
      "Maungawhau",
      "Karanga-a-Hape",
      "Te Waihorotiu",
    ]);
  });

  it("falls back to stop_code if the sequence points elsewhere", () => {
    // Sequence 5 on the Henderson-start trip is New Lynn, not Sunnyvale.
    expect(upstreamStations(fixtureOnehungaTrip, "9320", 5)).toEqual([
      "Henderson",
    ]);
  });

  it("gives nothing at the first stop or for a stop the trip skips", () => {
    expect(upstreamStations(fixtureManukauTrip, "9328", 1)).toEqual([]);
    expect(upstreamStations(fixtureManukauTrip, "9321")).toEqual([]);
    expect(upstreamStations([], "9320", 5)).toEqual([]);
  });

  it("honours a smaller count", () => {
    expect(upstreamStations(fixtureManukauTrip, "9320", 5, 2)).toEqual([
      "Sturges Rd",
      "Henderson",
    ]);
  });
});
