import { blendTheme } from "@/constants/theme";
import { skyAt } from "@/domain/sky";
import { useNow } from "@/hooks/use-now";

/**
 * The sky over Auckland right now (sun, moon, twilight) and the blended
 * palette for it, refreshed every `intervalMs`.
 */
export function useSky(intervalMs = 60_000) {
  const now = useNow(intervalMs);
  const sky = skyAt(now);
  return { now, sky, phase: sky.phase, theme: blendTheme(sky.progress) };
}
