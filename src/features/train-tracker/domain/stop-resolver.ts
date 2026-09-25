import type { Stop } from "@/features/train-tracker/domain/gtfs";

export class StopNotFoundError extends Error {
  constructor(
    readonly stopCode: string,
    readonly serviceDate: string,
  ) {
    super(`No stop with stop_code ${stopCode} on ${serviceDate}.`);
    this.name = "StopNotFoundError";
  }
}

type LoadStop = (
  stopCode: string,
  serviceDate: string,
) => Promise<Stop | undefined>;

/**
 * Resolves a stable stop_code to that day's stop_id (which carries a GTFS
 * version hash and changes when AT publishes a new feed). Results are cached
 * for the current service day only; failures are not cached.
 */
export function createStopResolver(load: LoadStop) {
  let day = "";
  const cache = new Map<string, Promise<Stop>>();

  return function resolveStop(
    stopCode: string,
    serviceDate: string,
  ): Promise<Stop> {
    if (serviceDate !== day) {
      cache.clear();
      day = serviceDate;
    }
    const cached = cache.get(stopCode);
    if (cached) return cached;

    const pending = load(stopCode, serviceDate).then((stop) => {
      if (!stop) throw new StopNotFoundError(stopCode, serviceDate);
      return stop;
    });
    cache.set(stopCode, pending);
    pending.catch(() => {
      if (cache.get(stopCode) === pending) cache.delete(stopCode);
    });
    return pending;
  };
}
