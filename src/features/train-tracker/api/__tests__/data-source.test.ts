import {
  type DataSource,
  ENV_DATA_SOURCE,
  getDataSource,
  setDataSource,
} from "@/features/train-tracker/api/data-source";

const other: DataSource = ENV_DATA_SOURCE === "mock" ? "live" : "mock";

afterEach(() => setDataSource(ENV_DATA_SOURCE));

it("starts from the .env default", () => {
  expect(getDataSource()).toBe(ENV_DATA_SOURCE);
});

it("switches until set back", () => {
  setDataSource(other);
  expect(getDataSource()).toBe(other);
  setDataSource(ENV_DATA_SOURCE);
  expect(getDataSource()).toBe(ENV_DATA_SOURCE);
});
