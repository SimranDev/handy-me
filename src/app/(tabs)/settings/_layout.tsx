import { Stack } from "expo-router";

import { useSky } from "@/hooks/use-sky";

/** Settings is a list of pages, each pushed over it inside the tab. */
export default function SettingsLayout() {
  const { theme } = useSky();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.card },
      }}
    />
  );
}
