import {
  activeProfile,
  addProfile,
  blankProfile,
  canAddProfile,
  clampWalkMinutes,
  type CommuteProfile,
  DEFAULT_SETTINGS,
  describeProfile,
  describeStation,
  missingSetup,
  normaliseDestinationLabel,
  normaliseProfileName,
  parseSettings,
  PROFILES_MAX,
  removeProfile,
  serialiseSettings,
  setAppearance,
  type Settings,
  type StationChoice,
  switchProfile,
  updateProfile,
} from "@/features/settings/domain/settings";

const sunnyvale: StationChoice = {
  stopCode: "9320",
  stationName: "Sunnyvale",
  platformCode: "1",
  directionId: 1,
  directionLabel: "towards Manukau via City Centre or Onehunga via Grafton",
};

const toWork: CommuteProfile = {
  id: "work",
  name: "To work",
  station: sunnyvale,
  walkMinutes: 7,
  destinationLabel: "Britomart",
};
const gym: CommuteProfile = {
  ...toWork,
  id: "gym",
  name: "Gym",
  destinationLabel: "Newmarket",
};
const home: CommuteProfile = {
  id: "home",
  name: "To home",
  station: null,
  walkMinutes: 4,
  destinationLabel: "",
};
const three: Settings = {
  profiles: [toWork, home, gym],
  activeProfileId: "home",
  appearance: "dark",
};

/** Settings read back from `value`, saved as JSON. */
function parsed(value: unknown): Settings {
  return parseSettings(JSON.stringify(value));
}

describe("clampWalkMinutes", () => {
  it.each([
    [7, 7],
    [1, 1],
    [30, 30],
    [0, 1],
    [-5, 1],
    [31, 30],
    [7.6, 8],
  ])("%p → %p", (input, expected) => {
    expect(clampWalkMinutes(input)).toBe(expected);
  });

  it.each([NaN, Infinity, "7", null, undefined])(
    "uses the default for %p",
    (input) => {
      expect(clampWalkMinutes(input)).toBe(7);
    },
  );
});

describe("normaliseDestinationLabel", () => {
  it("trims and collapses spaces", () => {
    expect(normaliseDestinationLabel("  Britomart \n  station ")).toBe(
      "Britomart station",
    );
  });

  it("caps the length without a trailing space", () => {
    const label = normaliseDestinationLabel(`${"a".repeat(39)} tail`);
    expect(label).toBe("a".repeat(39));
    expect(normaliseDestinationLabel("x".repeat(60))).toHaveLength(40);
  });

  it("allows empty, to hide the label", () => {
    expect(normaliseDestinationLabel("   ")).toBe("");
  });
});

describe("normaliseProfileName", () => {
  it("trims, collapses spaces and caps the length", () => {
    expect(normaliseProfileName("  To   work ")).toBe("To work");
    expect(normaliseProfileName("x".repeat(40))).toHaveLength(24);
    expect(normaliseProfileName("   ")).toBe("");
  });
});

describe("parseSettings", () => {
  it("round-trips saved settings", () => {
    expect(parseSettings(serialiseSettings(three))).toEqual(three);
  });

  it.each([null, "", "not json", "[]", "42", "null"])(
    "falls back to defaults for %p",
    (raw) => {
      expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
    },
  );

  it("turns settings saved before profiles into one profile", () => {
    const settings = parsed({
      station: sunnyvale,
      walkMinutes: 9,
      destinationLabel: "Britomart",
    });
    expect(settings.profiles).toEqual([
      {
        id: "default",
        name: "My commute",
        station: sunnyvale,
        walkMinutes: 9,
        destinationLabel: "Britomart",
      },
    ]);
    expect(settings.activeProfileId).toBe("default");
  });

  it("repairs bad profile fields one by one", () => {
    expect(
      parsed({
        profiles: [
          { id: "a", name: "  ", station: sunnyvale, walkMinutes: 99 },
          { id: "b", name: "Gym", destinationLabel: 12 },
        ],
        activeProfileId: "b",
      }),
    ).toEqual({
      profiles: [
        {
          ...blankProfile("a", "My commute"),
          station: sunnyvale,
          walkMinutes: 30,
        },
        blankProfile("b", "Gym"),
      ],
      activeProfileId: "b",
      appearance: "system",
    });
  });

  it("keeps a saved appearance and ignores an unknown one", () => {
    const profiles = [toWork];
    expect(parsed({ profiles, appearance: "light" }).appearance).toBe("light");
    expect(parsed({ profiles, appearance: "sepia" }).appearance).toBe("system");
    expect(parsed({ profiles }).appearance).toBe("system");
    expect(parsed({ walkMinutes: 9 }).appearance).toBe("system");
  });

  it("drops profiles without a usable, unique id", () => {
    const settings = parsed({
      profiles: [
        { ...toWork, id: "" },
        { ...toWork, id: "has space" },
        { ...toWork, id: 3 },
        "work",
        null,
        toWork,
        { ...gym, id: "work" },
      ],
      activeProfileId: "work",
    });
    expect(settings.profiles).toEqual([toWork]);
  });

  it("uses the first profile when the active one is missing", () => {
    expect(
      parsed({ profiles: [toWork, gym], activeProfileId: "gone" })
        .activeProfileId,
    ).toBe("work");
  });

  it("falls back to defaults when no profile survives", () => {
    expect(parsed({ profiles: [], activeProfileId: "x" })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it("keeps at most PROFILES_MAX profiles", () => {
    const many = Array.from({ length: PROFILES_MAX + 3 }, (_, i) =>
      blankProfile(`p${i}`, `P${i}`),
    );
    expect(
      parsed({ profiles: many, activeProfileId: "p0" }).profiles,
    ).toHaveLength(PROFILES_MAX);
  });

  it.each([
    { ...sunnyvale, stopCode: "" },
    { ...sunnyvale, stopCode: "93 20" },
    { ...sunnyvale, stopCode: 9320 },
    { ...sunnyvale, stationName: "  " },
    "9320",
  ])("drops an unusable station %#", (station) => {
    expect(
      parsed({ profiles: [{ ...toWork, station }] }).profiles[0].station,
    ).toBeNull();
  });

  it("tolerates missing optional station fields", () => {
    expect(
      parsed({
        profiles: [
          { ...toWork, station: { stopCode: "9320", stationName: "S" } },
        ],
      }).profiles[0].station,
    ).toEqual({
      stopCode: "9320",
      stationName: "S",
      platformCode: null,
      directionId: null,
      directionLabel: null,
    });
  });
});

describe("profiles", () => {
  it("finds the active profile", () => {
    expect(activeProfile(three)).toBe(home);
    expect(activeProfile({ ...three, activeProfileId: "gone" })).toBe(toWork);
  });

  it("adds a blank profile without switching to it", () => {
    const next = addProfile(three, "new");
    expect(next.profiles.at(-1)).toEqual(blankProfile("new", "New profile"));
    expect(next.activeProfileId).toBe("home");
  });

  it("won't add a duplicate id or go past the limit", () => {
    expect(addProfile(three, "work")).toBe(three);
    const full: Settings = {
      profiles: Array.from({ length: PROFILES_MAX }, (_, i) =>
        blankProfile(`p${i}`, `P${i}`),
      ),
      activeProfileId: "p0",
      appearance: "system",
    };
    expect(canAddProfile(full)).toBe(false);
    expect(addProfile(full, "one-more")).toBe(full);
  });

  it("updates one profile and keeps its id", () => {
    const next = updateProfile(three, "gym", (p) => ({
      ...p,
      id: "sneaky",
      walkMinutes: 12,
    }));
    expect(next.profiles[2]).toEqual({ ...gym, walkMinutes: 12 });
    expect(next.profiles.slice(0, 2)).toEqual([toWork, home]);
  });

  it("switches only to a profile that exists", () => {
    expect(switchProfile(three, "gym").activeProfileId).toBe("gym");
    expect(switchProfile(three, "gone")).toBe(three);
  });

  it("removes an inactive profile and keeps the active one", () => {
    expect(removeProfile(three, "gym")).toEqual({
      profiles: [toWork, home],
      activeProfileId: "home",
      appearance: "dark",
    });
  });

  it("switches to the previous profile when the active one is removed", () => {
    expect(removeProfile(three, "home").activeProfileId).toBe("work");
    expect(
      removeProfile({ ...three, activeProfileId: "work" }, "work")
        .activeProfileId,
    ).toBe("home");
  });

  it("sets the appearance without touching profiles", () => {
    const next = setAppearance(three, "light");
    expect(next.appearance).toBe("light");
    expect(next.profiles).toBe(three.profiles);
    expect(next.activeProfileId).toBe("home");
  });

  it("never removes the last profile", () => {
    expect(removeProfile(DEFAULT_SETTINGS, "default")).toBe(DEFAULT_SETTINGS);
    expect(removeProfile(three, "gone")).toBe(three);
  });

  it("describes a profile", () => {
    expect(describeProfile(toWork)).toBe("Sunnyvale → Britomart · 7 min walk");
    expect(describeProfile({ ...toWork, destinationLabel: "" })).toBe(
      "Sunnyvale · 7 min walk",
    );
    expect(describeProfile(home)).toBe("No station yet · 4 min walk");
  });
});

describe("missingSetup", () => {
  it("needs a key and a station for live data", () => {
    expect(missingSetup("live", false, null)).toEqual(["key", "station"]);
    expect(missingSetup("live", true, null)).toEqual(["station"]);
    expect(missingSetup("live", false, sunnyvale)).toEqual(["key"]);
    expect(missingSetup("live", true, sunnyvale)).toEqual([]);
  });

  it("needs nothing for mock data", () => {
    expect(missingSetup("mock", false, null)).toEqual([]);
  });
});

it("describes a station choice", () => {
  expect(describeStation(sunnyvale)).toBe("Sunnyvale · Platform 1");
  expect(describeStation({ ...sunnyvale, platformCode: null })).toBe(
    "Sunnyvale",
  );
});
