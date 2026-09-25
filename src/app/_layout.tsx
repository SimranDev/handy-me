import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from "@expo-google-fonts/fraunces";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import AppTabs from "@/components/app-tabs";
import { QueryProvider } from "@/components/query-provider";
import { usePhase } from "@/hooks/use-phase";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
  });
  const { phase } = usePhase();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <QueryProvider>
      <StatusBar style={phase === "night" ? "light" : "dark"} />
      <AppTabs />
    </QueryProvider>
  );
}
