import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_SETTINGS,
  updateProfile,
} from "@/features/settings/domain/settings";
import {
  clearSettingsStorageForTests,
  currentSettingsForTests,
  hydrateSettings,
  resetSettingsStoreForTests,
  updateSettings,
} from "@/features/settings/store/settings-store";

/** Load the store as a fresh app launch would, and return its settings. */
async function launch() {
  resetSettingsStoreForTests();
  await hydrateSettings();
  return currentSettingsForTests();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  clearSettingsStorageForTests();
  resetSettingsStoreForTests();
});

it("starts from defaults", async () => {
  expect(await launch()).toEqual(DEFAULT_SETTINGS);
});

it("persists changes across launches", async () => {
  await hydrateSettings();
  updateSettings((s) =>
    updateProfile(s, "default", (p) => ({ ...p, walkMinutes: 12 })),
  );
  updateSettings((s) =>
    updateProfile(s, "default", (p) => ({ ...p, destinationLabel: "Home" })),
  );

  resetSettingsStoreForTests();
  // Saved settings are ready at once, without waiting on a load.
  expect(currentSettingsForTests()?.profiles[0]).toMatchObject({
    walkMinutes: 12,
    destinationLabel: "Home",
  });
});

it("applies a change made before the first load finishes", async () => {
  expect(currentSettingsForTests()).toBeNull();
  updateSettings((s) =>
    updateProfile(s, "default", (p) => ({ ...p, walkMinutes: 15 })),
  );
  await hydrateSettings();
  expect(currentSettingsForTests()?.profiles[0].walkMinutes).toBe(15);
});

it("brings over settings saved with AsyncStorage, once", async () => {
  await AsyncStorage.setItem(
    "settings.v1",
    JSON.stringify({ walkMinutes: 9, destinationLabel: "Britomart" }),
  );
  expect((await launch())?.profiles).toEqual([
    {
      ...DEFAULT_SETTINGS.profiles[0],
      walkMinutes: 9,
      destinationLabel: "Britomart",
    },
  ]);
  expect(await AsyncStorage.getItem("settings.v1")).toBeNull();
});

it("recovers from corrupt legacy storage", async () => {
  await AsyncStorage.setItem("settings.v1", "{oops");
  expect(await launch()).toEqual(DEFAULT_SETTINGS);
});
