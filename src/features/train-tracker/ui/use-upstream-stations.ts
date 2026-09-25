import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getArrivalsSource } from "@/features/train-tracker/api/arrivals-source";
import { useDataSource } from "@/features/train-tracker/api/data-source";
import type { Arrival } from "@/features/train-tracker/domain/arrivals";
import type { CommuteStop } from "@/features/train-tracker/domain/arrivals-source";
import { upstreamStations } from "@/features/train-tracker/domain/upstream";
import { HOUR } from "@/domain/time";

/**
 * Stations the `trip` calls at before `stop`, nearest last, for the scene.
 * A trip's stops don't change within its service day, so each is fetched
 * once per day; the previous trip's stations stay up while the next loads.
 */
export function useUpstreamStations(
  stop: CommuteStop | null,
  trip: Arrival | null,
): string[] {
  const dataSource = useDataSource();
  const { data } = useQuery({
    queryKey: [
      "train-tracker",
      "trip-stops",
      dataSource,
      trip?.serviceDate,
      trip?.tripId,
    ],
    queryFn: ({ signal }) =>
      getArrivalsSource(dataSource, stop!).getTripStops(
        trip!.tripId,
        trip!.serviceDate,
        signal,
      ),
    enabled: stop != null && trip != null,
    staleTime: Infinity,
    gcTime: 6 * HOUR,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  if (!data || !stop) return [];
  return upstreamStations(data, stop.stopCode, trip?.stopSequence);
}
