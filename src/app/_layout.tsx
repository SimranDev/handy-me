import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Appearance, Platform } from "react-native";

import { QueryProvider } from "@/components/query-provider";
import { useAppearancePreference, useSky } from "@/hooks/use-sky";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });
  const { phase, appearance } = useSky();
  // The Commute screen's status bar sits on the sky; every other screen's
  // on the app surface, which follows light or dark mode.
  const onSky = usePathname() === "/";
  const dark = onSky ? phase === "night" : appearance === "dark";

  // Native pieces (alerts, the keyboard) follow the choice in Settings too.
  // Browsers can't be told, so web only recolours the app itself.
  const preference = useAppearancePreference();
  useEffect(() => {
    if (Platform.OS === "web") return;
    Appearance.setColorScheme(
      preference === "system" ? "unspecified" : preference,
    );
  }, [preference]);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <QueryProvider>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/* Hidden: opened by long-pressing the Commute tab. */}
        <Stack.Screen name="dev" options={{ presentation: "modal" }} />
        <Stack.Screen name="profile" options={{ presentation: "modal" }} />
        <Stack.Screen name="station" options={{ presentation: "modal" }} />
      </Stack>
    </QueryProvider>
  );
}
