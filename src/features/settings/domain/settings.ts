/**
 * The user's commute settings. None of these are secrets, so they live in a
 * plain persisted store; the AT API key is kept apart, in secure store.
 */
export type StationChoice = {
  /** The platform's stop_code: stable across GTFS versions, unlike stop_id. */
  stopCode: string;
  /** Short station name, e.g. "Sunnyvale". */
  stationName: string;
  platformCode: string | null;
  /** Direction of travel from this platform; null for every train there. */
  directionId: number | null;
  /** e.g. "towards Manukau via City Centre", for showing the choice. */
  directionLabel: string | null;
};

/** One commute: where you leave from, how long the walk is, where you're going. */
export type CommuteProfile = {
  /** Stable id, never shown. */
  id: string;
  /** What you call it, e.g. "To work". */
  name: string;
  station: StationChoice | null;
  /** Minutes from your door to the platform. */
  walkMinutes: number;
  /** Where you're going, e.g. "Britomart". "" to leave it out. */
  destinationLabel: string;
};

/** There is always at least one profile, and exactly one is active. */
export type Settings = {
  profiles: CommuteProfile[];
  activeProfileId: string;
};

export const WALK_MINUTES_MIN = 1;
export const WALK_MINUTES_MAX = 30;
export const DEFAULT_WALK_MINUTES = 7;
export const DESTINATION_LABEL_MAX = 40;
export const PROFILE_NAME_MAX = 24;
export const PROFILES_MAX = 8;
export const DEFAULT_PROFILE_NAME = "My commute";
export const NEW_PROFILE_NAME = "New profile";

const DEFAULT_PROFILE_ID = "default";

export function blankProfile(id: string, name: string): CommuteProfile {
  return {
    id,
    name,
    station: null,
    walkMinutes: DEFAULT_WALK_MINUTES,
    destinationLabel: "",
  };
}

export const DEFAULT_SETTINGS: Settings = {
  profiles: [blankProfile(DEFAULT_PROFILE_ID, DEFAULT_PROFILE_NAME)],
  activeProfileId: DEFAULT_PROFILE_ID,
};

/** A whole number of minutes within range; anything unusable is the default. */
export function clampWalkMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_WALK_MINUTES;
  }
  return Math.min(
    WALK_MINUTES_MAX,
    Math.max(WALK_MINUTES_MIN, Math.round(value)),
  );
}

/** Trimmed, single-spaced and at most `max` characters. */
function normaliseText(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/** Trimmed, single-spaced and at most DESTINATION_LABEL_MAX characters. */
export function normaliseDestinationLabel(value: string): string {
  return normaliseText(value, DESTINATION_LABEL_MAX);
}

/** As for the destination label; the caller decides what an empty name means. */
export function normaliseProfileName(value: string): string {
  return normaliseText(value, PROFILE_NAME_MAX);
}

function parseStation(value: unknown): StationChoice | null {
  if (typeof value !== "object" || value == null) return null;
  const v = value as Record<string, unknown>;
  const stopCode = typeof v.stopCode === "string" ? v.stopCode.trim() : "";
  const stationName =
    typeof v.stationName === "string" ? v.stationName.trim() : "";
  if (!/^[A-Za-z0-9-]+$/.test(stopCode) || !stationName) return null;
  return {
    stopCode,
    stationName,
    platformCode:
      typeof v.platformCode === "string" && v.platformCode
        ? v.platformCode
        : null,
    directionId:
      typeof v.directionId === "number" && Number.isInteger(v.directionId)
        ? v.directionId
        : null,
    directionLabel:
      typeof v.directionLabel === "string" && v.directionLabel
        ? v.directionLabel
        : null,
  };
}

function parseProfile(value: unknown, id: string): CommuteProfile {
  const v = value as Record<string, unknown>;
  const name = typeof v.name === "string" ? normaliseProfileName(v.name) : "";
  return {
    id,
    name: name || DEFAULT_PROFILE_NAME,
    station: parseStation(v.station),
    walkMinutes: clampWalkMinutes(v.walkMinutes),
    destinationLabel:
      typeof v.destinationLabel === "string"
        ? normaliseDestinationLabel(v.destinationLabel)
        : "",
  };
}

const PROFILE_ID = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * Settings read back from storage. Missing, corrupt or out-of-range values
 * fall back to defaults field by field rather than failing as a whole.
 * Settings saved before profiles existed (one commute at the top level)
 * become a single profile.
 */
export function parseSettings(raw: string | null): Settings {
  let value: unknown;
  try {
    value = raw == null ? null : JSON.parse(raw);
  } catch {
    value = null;
  }
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return DEFAULT_SETTINGS;
  }
  const v = value as Record<string, unknown>;

  if (!Array.isArray(v.profiles)) {
    const legacy = parseProfile(v, DEFAULT_PROFILE_ID);
    return { profiles: [legacy], activeProfileId: legacy.id };
  }

  const seen = new Set<string>();
  const profiles: CommuteProfile[] = [];
  for (const item of v.profiles) {
    if (typeof item !== "object" || item == null) continue;
    const id = (item as Record<string, unknown>).id;
    if (typeof id !== "string" || !PROFILE_ID.test(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    profiles.push(parseProfile(item, id));
    if (profiles.length === PROFILES_MAX) break;
  }
  if (profiles.length === 0) return DEFAULT_SETTINGS;
  return {
    profiles,
    activeProfileId: seen.has(v.activeProfileId as string)
      ? (v.activeProfileId as string)
      : profiles[0].id,
  };
}

export function serialiseSettings(settings: Settings): string {
  return JSON.stringify(settings);
}

export function activeProfile(settings: Settings): CommuteProfile {
  return (
    settings.profiles.find((p) => p.id === settings.activeProfileId) ??
    settings.profiles[0]
  );
}

export function findProfile(
  settings: Settings,
  id: string,
): CommuteProfile | null {
  return settings.profiles.find((p) => p.id === id) ?? null;
}

export function canAddProfile(settings: Settings): boolean {
  return settings.profiles.length < PROFILES_MAX;
}

/** Adds a blank profile at the end, without switching to it. */
export function addProfile(
  settings: Settings,
  id: string,
  name = NEW_PROFILE_NAME,
): Settings {
  if (!canAddProfile(settings) || findProfile(settings, id)) return settings;
  return {
    ...settings,
    profiles: [...settings.profiles, blankProfile(id, name)],
  };
}

export function updateProfile(
  settings: Settings,
  id: string,
  change: (profile: CommuteProfile) => CommuteProfile,
): Settings {
  return {
    ...settings,
    profiles: settings.profiles.map((p) =>
      p.id === id ? { ...change(p), id } : p,
    ),
  };
}

/**
 * Removes a profile, unless it's the last one. Removing the active profile
 * switches to the one before it (or the new first one).
 */
export function removeProfile(settings: Settings, id: string): Settings {
  const index = settings.profiles.findIndex((p) => p.id === id);
  if (index < 0 || settings.profiles.length === 1) return settings;
  const profiles = settings.profiles.filter((p) => p.id !== id);
  const activeProfileId =
    settings.activeProfileId === id
      ? profiles[Math.max(0, index - 1)].id
      : settings.activeProfileId;
  return { profiles, activeProfileId };
}

export function switchProfile(settings: Settings, id: string): Settings {
  return findProfile(settings, id)
    ? { ...settings, activeProfileId: id }
    : settings;
}

export type SetupStep = "key" | "station";

/**
 * What's still needed before live trains can show. The mock data source
 * needs neither: it runs without an API key.
 */
export function missingSetup(
  dataSource: "mock" | "live",
  hasKey: boolean,
  station: StationChoice | null,
): SetupStep[] {
  if (dataSource === "mock") return [];
  return [
    ...(hasKey ? [] : (["key"] as const)),
    ...(station ? [] : (["station"] as const)),
  ];
}

/** e.g. "Sunnyvale · Platform 1". */
export function describeStation(station: StationChoice): string {
  return station.platformCode
    ? `${station.stationName} · Platform ${station.platformCode}`
    : station.stationName;
}

/** e.g. "Sunnyvale → Britomart · 7 min walk". */
export function describeProfile(profile: CommuteProfile): string {
  const route = profile.station
    ? profile.destinationLabel
      ? `${profile.station.stationName} → ${profile.destinationLabel}`
      : profile.station.stationName
    : "No station yet";
  return `${route} · ${profile.walkMinutes} min walk`;
}
