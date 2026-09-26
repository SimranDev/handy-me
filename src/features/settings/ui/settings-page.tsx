import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTabBarHeight } from "@/components/app-tabs";
import { FontFamily, type AppTheme } from "@/constants/theme";

const backToSettings = () =>
  router.canGoBack() ? router.back() : router.replace("/settings");

/** A page opened from the Settings list: a way back, a title, then its content. */
export function SettingsPage({
  theme: t,
  title,
  children,
}: {
  theme: AppTheme;
  title: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  return (
    <ScrollView
      style={{ backgroundColor: t.card }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top + 11, 58),
          paddingBottom: tabBarHeight + 32,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <Pressable
        onPress={backToSettings}
        accessibilityRole="button"
        accessibilityLabel="Back to Settings"
        hitSlop={12}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={[styles.backText, { color: t.cardInk }]}>‹ Settings</Text>
      </Pressable>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: t.cardInk }]}
      >
        {title}
      </Text>
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    gap: 22,
  },
  back: {
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center",
  },
  backText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 34,
    lineHeight: 38,
  },
  body: {
    gap: 10,
  },
});
