import { blendTheme } from "@/constants/theme";
import { skyAt } from "@/domain/sky";
import { useNow } from "@/hooks/use-now";
import { useSkyPreview } from "@/hooks/sky-preview";

/**
 * The sky over Auckland right now (sun, moon, twilight) and the blended
 * palette for it, refreshed every `intervalMs`. A dev-menu preview replaces
 * the sky and palette, but `now` stays the real time.
 */
export function useSky(intervalMs = 60_000) {
  const now = useNow(intervalMs);
  const preview = useSkyPreview();
  const sky = skyAt(preview.at ?? now);
  return { now, sky, phase: sky.phase, theme: blendTheme(sky.progress) };
}
