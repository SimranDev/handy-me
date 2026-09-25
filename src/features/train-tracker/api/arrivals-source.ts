import { DATA_SOURCE } from "@/features/train-tracker/api/data-source";
import { createLiveArrivalsSource } from "@/features/train-tracker/api/live-source";
import type { ArrivalsSource } from "@/features/train-tracker/domain/arrivals-source";
import { HOME_STOP_CODE } from "@/features/train-tracker/domain/config";
import { createMockArrivalsSource } from "@/features/train-tracker/mock/mock-source";

let source: ArrivalsSource | undefined;

/** The arrivals source picked by EXPO_PUBLIC_DATA_SOURCE, created once. */
export function getArrivalsSource(): ArrivalsSource {
  source ??=
    DATA_SOURCE === "live"
      ? createLiveArrivalsSource(HOME_STOP_CODE)
      : createMockArrivalsSource();
  return source;
}
