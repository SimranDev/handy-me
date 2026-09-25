import {
  fixturePlatformTrips,
  fixtureRailStops,
  fixtureStop,
} from "@/features/train-tracker/domain/__fixtures__/station-samples";
import {
  deriveDestinationLabel,
  directionLabel,
  platformDirections,
  railStations,
  searchStations,
  shortStationName,
} from "@/features/train-tracker/domain/stations";

const stations = railStations(fixtureRailStops);
const names = (list: { name: string }[]) => list.map((s) => s.name);

describe("shortStationName", () => {
  it.each([
    ["Sunnyvale Train Station", "Sunnyvale"],
    ["Sunnyvale Train Station 1", "Sunnyvale"],
    ["Maungawhau Train Station 3", "Maungawhau"],
    ["Hamilton Frankton", "Hamilton Frankton"],
    ["Titi Street/Otahuhu Train Station", "Titi Street/Otahuhu"],
  ])("%s → %s", (name, short) => {
    expect(shortStationName(name)).toBe(short);
  });
});

describe("railStations", () => {
  it("keeps rail stations only, sorted by name", () => {
    expect(stations).toHaveLength(49);
    expect(names(stations)).toEqual([...names(stations)].sort());
    // Bus stops named after the station (vehicle_type 3), a bus "station"
    // and a stop with no vehicle_type are all left out.
    expect(names(stations)).not.toContain("Sunnyvale Station");
    expect(names(stations)).not.toContain("Te Waihorotiu Station");
    expect(names(stations)).not.toContain("The Civic");
  });

  it("lists a station's platforms in platform order", () => {
    const sunnyvale = stations.find((s) => s.name === "Sunnyvale")!;
    expect(sunnyvale.stopId).toBe("121-5413495e");
    expect(
      sunnyvale.platforms.map((p) => [p.platform_code, p.stop_code]),
    ).toEqual([
      ["1", "9320"],
      ["2", "9321"],
    ]);
  });

  it("treats a rail platform with no parent station as its own station", () => {
    const titi = stations.find((s) => s.name === "Titi Street/Otahuhu")!;
    expect(titi.platforms).toHaveLength(1);
    expect(titi.platforms[0].stop_id).toBe(titi.stopId);
  });
});

describe("searchStations", () => {
  it("returns every station for an empty query", () => {
    expect(searchStations(stations, "  ")).toBe(stations);
  });

  it("finds a station by the start of its name, ignoring case", () => {
    expect(names(searchStations(stations, "SUNNY"))).toEqual(["Sunnyvale"]);
  });

  it("ranks name starts, then word starts, then anywhere", () => {
    expect(names(searchStations(stations, "wai"))).toEqual([
      "Waitemata",
      "Te Waihorotiu",
    ]);
    expect(names(searchStations(stations, "park")).slice(0, 1)).toEqual([
      "Sylvia Park",
    ]);
  });

  it("ignores punctuation and macrons", () => {
    expect(names(searchStations(stations, "Mt. Albert"))).toEqual([
      "Mt Albert",
    ]);
    expect(names(searchStations(stations, "Ōtāhuhu"))).toEqual([
      "Otahuhu",
      "Titi Street/Otahuhu",
    ]);
  });

  it("returns nothing when no station matches", () => {
    expect(searchStations(stations, "Britomart")).toEqual([]);
  });
});

describe("platformDirections", () => {
  it("groups a platform's trips by direction, most frequent headsign first", () => {
    expect(
      platformDirections(fixtureStop("9320"), fixturePlatformTrips["9320"]),
    ).toEqual([
      {
        stopCode: "9320",
        platformCode: "1",
        directionId: 1,
        headsigns: ["Manukau via City Centre", "Onehunga via Grafton"],
        tripCount: 6,
      },
    ]);
    expect(
      platformDirections(fixtureStop("9321"), fixturePlatformTrips["9321"]),
    ).toEqual([
      expect.objectContaining({
        stopCode: "9321",
        directionId: 0,
        headsigns: ["Swanson", "Henderson"],
      }),
    ]);
  });

  it("leaves out trips that end at the platform", () => {
    // Swanson 1 also sees trains arriving from Manukau that terminate there.
    expect(
      platformDirections(fixtureStop("9328"), fixturePlatformTrips["9328"]),
    ).toEqual([
      {
        stopCode: "9328",
        platformCode: "1",
        directionId: 1,
        headsigns: ["Manukau via City Centre"],
        tripCount: 3,
      },
    ]);
  });

  it("keeps a platform with no trips pickable, direction unknown", () => {
    // Swanson 2: AT answers 404 for its stoptrips, read as no trips.
    expect(platformDirections(fixtureStop("9329"), [])).toEqual([
      {
        stopCode: "9329",
        platformCode: "2",
        directionId: null,
        headsigns: [],
        tripCount: 0,
      },
    ]);
  });

  it("puts the busier direction first when a platform serves both", () => {
    const outbound = fixturePlatformTrips["9320"];
    const inbound = fixturePlatformTrips["9321"].slice(0, 2);
    const directions = platformDirections(fixtureStop("9320"), [
      ...inbound,
      ...outbound,
    ]);
    expect(directions.map((d) => [d.directionId, d.tripCount])).toEqual([
      [1, 6],
      [0, 2],
    ]);
  });
});

describe("direction labels", () => {
  const [sunnyvale1] = platformDirections(
    fixtureStop("9320"),
    fixturePlatformTrips["9320"],
  );

  it("describes where a platform's trains go", () => {
    expect(directionLabel(sunnyvale1)).toBe(
      "towards Manukau via City Centre or Onehunga via Grafton",
    );
    expect(directionLabel({ ...sunnyvale1, headsigns: ["A", "B", "C"] })).toBe(
      "towards A, B or C",
    );
    expect(directionLabel({ ...sunnyvale1, headsigns: [] })).toBe(
      "No trains found today",
    );
  });

  it("derives the destination from the main headsign", () => {
    expect(deriveDestinationLabel(sunnyvale1)).toBe("Manukau via City Centre");
    expect(deriveDestinationLabel({ ...sunnyvale1, headsigns: [] })).toBe("");
  });
});
