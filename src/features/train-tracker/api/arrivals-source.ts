import type { DataSource } from "@/features/train-tracker/api/data-source";
import { createLiveArrivalsSource } from "@/features/train-tracker/api/live-source";
import type {
  ArrivalsSource,
  CommuteStop,
} from "@/features/train-tracker/domain/arrivals-source";
import { createMockArrivalsSource } from "@/features/train-tracker/mock/mock-source";

let current: { key: string; source: ArrivalsSource } | undefined;

/**
 * The arrivals source for `dataSource` and `stop`, kept (with its caches)
 * until either changes.
 */
export function getArrivalsSource(
  dataSource: DataSource,
  stop: CommuteStop,
): ArrivalsSource {
  const key = `${dataSource}|${stop.stopCode}|${stop.directionId ?? ""}`;
  if (current?.key !== key) {
    current = {
      key,
      source:
        dataSource === "live"
          ? createLiveArrivalsSource(stop)
          : createMockArrivalsSource(stop.stopCode),
    };
  }
  return current.source;
}
