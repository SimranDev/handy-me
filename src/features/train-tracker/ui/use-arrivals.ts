import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useRef } from "react";

import { getArrivalsSource } from "@/features/train-tracker/api/arrivals-source";
import { DATA_SOURCE } from "@/features/train-tracker/api/data-source";

const POLL_MS = 30_000;
const QUERY_KEY = ["train-tracker", "arrivals", DATA_SOURCE];

/**
 * Arrivals for the home stop, polled every 30s only while this screen is
 * focused and the app is foregrounded (see QueryProvider). Retries happen in
 * the AT client, so React Query doesn't retry on top.
 */
export function useArrivals() {
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) =>
      getArrivalsSource().getArrivals(Date.now(), signal),
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
      queryClient.refetchQueries({ queryKey: QUERY_KEY, stale: true });
    }, [queryClient]),
  );

  return query;
}
