export type DataSource = "mock" | "live";

/**
 * Where train data comes from, set by EXPO_PUBLIC_DATA_SOURCE in .env
 * (defaults to "mock"). This only picks the source: the AT API key is never
 * read from env; it comes from expo-secure-store (see CLAUDE.md).
 */
export const DATA_SOURCE: DataSource = parseDataSource(
  // Must stay a static dot-access so Expo can inline it at build time.
  process.env.EXPO_PUBLIC_DATA_SOURCE,
);

function parseDataSource(value: string | undefined): DataSource {
  if (value == null || value === "") return "mock";
  if (value === "mock" || value === "live") return value;
  throw new Error(
    `EXPO_PUBLIC_DATA_SOURCE must be "mock" or "live", got "${value}".`,
  );
}
