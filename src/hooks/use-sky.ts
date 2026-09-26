import { useColorScheme } from "react-native";

import { type Appearance, blendTheme } from "@/constants/theme";
import { skyAt } from "@/domain/sky";
import type { AppearancePreference } from "@/features/settings/domain/settings";
import { useSettings } from "@/features/settings/store/settings-store";
import { useNow } from "@/hooks/use-now";
import { useSkyPreview } from "@/hooks/sky-preview";

/**
 * The sky over Auckland right now (sun, moon, twilight) and the app's
 * palette: the scene's colours follow that sky; the surfaces are light or
 * dark as chosen in Settings (by default, as the phone is). Refreshed every
 * `intervalMs`. A dev-menu preview replaces the sky, but `now` stays the
 * real time.
 */
export function useSky(intervalMs = 60_000) {
  const now = useNow(intervalMs);
  const preview = useSkyPreview();
  const system: Appearance = useColorScheme() === "dark" ? "dark" : "light";
  const chosen = useAppearancePreference();
  const appearance = chosen === "system" ? system : chosen;
  const sky = skyAt(preview.at ?? now);
  return {
    now,
    sky,
    phase: sky.phase,
    appearance,
    theme: blendTheme(sky.progress, appearance),
  };
}

/** Light, dark or "system", as chosen in Settings ("system" until loaded). */
export function useAppearancePreference(): AppearancePreference {
  const settingsState = useSettings();
  return settingsState.status === "ready"
    ? settingsState.settings.appearance
    : "system";
}
