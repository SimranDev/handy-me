import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useRef } from "react";

import { getArrivalsSource } from "@/features/train-tracker/api/arrivals-source";
import { useDataSource } from "@/features/train-tracker/api/data-source";
import type { CommuteStop } from "@/features/train-tracker/domain/arrivals-source";

const POLL_MS = 30_000;
const ARRIVALS_KEY = ["train-tracker", "arrivals"] as const;

/**
 * Arrivals for `stop`, polled every 30s only while this screen is focused
 * and the app is foregrounded (see QueryProvider). Retries happen in the AT
 * client, so React Query doesn't retry on top. Nothing is fetched while
 * `stop` is null or `enabled` is false.
 */
export function useArrivals(stop: CommuteStop | null, enabled = true) {
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const dataSource = useDataSource();

  const query = useQuery({
    queryKey: [...ARRIVALS_KEY, dataSource, stop?.stopCode, stop?.directionId],
    queryFn: ({ signal }) =>
      getArrivalsSource(dataSource, stop!).getArrivals(Date.now(), signal),
    enabled: enabled && stop != null,
    refetchInterval: isFocused ? POLL_MS : false,
    staleTime: POLL_MS - 5_000,
    retry: false,
  });

  // Coming back to the tab: refresh straight away if the data is stale,
  // rather than waiting for the next interval.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      queryClient.refetchQueries({ queryKey: ARRIVALS_KEY, stale: true });
    }, [queryClient]),
  );

  return query;
}
