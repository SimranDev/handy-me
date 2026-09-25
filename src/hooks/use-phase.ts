import { PhaseThemes, phaseFor } from "@/constants/theme";
import { useNow } from "@/hooks/use-now";

/** Time-of-day phase and its palette, re-evaluated every minute. */
export function usePhase() {
  const now = useNow(60_000);
  const phase = phaseFor(new Date(now).getHours());
  return { phase, theme: PhaseThemes[phase] };
}
