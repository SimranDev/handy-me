import { fixtureStops } from "@/features/train-tracker/domain/__fixtures__/at-samples";
import {
  createStopResolver,
  StopNotFoundError,
} from "@/features/train-tracker/domain/stop-resolver";

function setup() {
  const load = jest.fn(async (code: string) =>
    fixtureStops.find((s) => s.stop_code === code),
  );
  return { load, resolve: createStopResolver(load) };
}

it("resolves a stop_code to that day's stop_id", async () => {
  const { resolve } = setup();
  await expect(resolve("9320", "2026-09-25")).resolves.toMatchObject({
    stop_id: "9320-36be46d2",
    platform_code: "1",
  });
});

it("caches per service day", async () => {
  const { load, resolve } = setup();
  await resolve("9320", "2026-09-25");
  await resolve("9320", "2026-09-25");
  expect(load).toHaveBeenCalledTimes(1);

  await resolve("9320", "2026-09-26");
  expect(load).toHaveBeenCalledTimes(2);
  expect(load).toHaveBeenLastCalledWith("9320", "2026-09-26");
});

it("fails for unknown codes without caching the failure", async () => {
  const { load, resolve } = setup();
  await expect(resolve("0000", "2026-09-25")).rejects.toBeInstanceOf(
    StopNotFoundError,
  );
  await expect(resolve("0000", "2026-09-25")).rejects.toBeInstanceOf(
    StopNotFoundError,
  );
  expect(load).toHaveBeenCalledTimes(2);
});
