// Reanimated's Jest utilities (see https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/).
require("react-native-reanimated").setUpTests();

// In-memory AsyncStorage (see https://react-native-async-storage.github.io/async-storage/docs/advanced/jest).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// MMKV swaps in an in-memory mock under Jest, but still imports Nitro, whose
// native module doesn't exist here (see https://github.com/mrousavy/react-native-mmkv).
jest.mock("react-native-nitro-modules", () => ({ NitroModules: {} }));
