import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily } from "@/constants/theme";
import {
  canAddProfile,
  switchProfile,
} from "@/features/settings/domain/settings";
import {
  updateSettings,
  useSettings,
} from "@/features/settings/store/settings-store";
import { startNewProfile } from "@/features/settings/ui/new-profile";
import { ProfileRow } from "@/features/settings/ui/profile-row";
import { useSky } from "@/hooks/use-sky";

/** Opened from the Commute screen: switch, edit or add a commute profile. */
export function ProfileSheetScreen() {
  const { theme: t } = useSky();
  const insets = useSafeAreaInsets();
  const settingsState = useSettings();
  const [editing, setEditing] = useState(false);

  if (settingsState.status !== "ready") return null;
  const { settings } = settingsState;

  const choose = (id: string) => {
    if (editing) {
      router.push({ pathname: "/profile", params: { id } });
      return;
    }
    if (id !== settings.activeProfileId) {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      updateSettings((s) => switchProfile(s, id));
    }
    router.back();
  };

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: t.card,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
        },
      ]}
    >
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: t.cardInk }]}
        >
          Commute profile
        </Text>
        <Pressable
          onPress={() => setEditing((e) => !e)}
          accessibilityRole="button"
          accessibilityLabel={editing ? "Done editing" : "Edit profiles"}
          hitSlop={12}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={[styles.headerAction, { color: t.cardInk }]}>
            {editing ? "Done" : "Edit"}
          </Text>
        </Pressable>
      </View>

      <View accessibilityRole={editing ? undefined : "radiogroup"}>
        {settings.profiles.map((profile) => (
          <ProfileRow
            key={profile.id}
            theme={t}
            profile={profile}
            active={profile.id === settings.activeProfileId}
            trailing={editing ? "chevron" : "radio"}
            accessibilityHint={
              editing ? "Edit this profile" : "Plan trains for this commute"
            }
            onPress={() => choose(profile.id)}
          />
        ))}
      </View>

      {canAddProfile(settings) && (
        <Pressable
          onPress={startNewProfile}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.add,
            { borderColor: t.rule },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.addText, { color: t.cardInk2 }]}>
            + Add profile
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingTop: 28,
    paddingHorizontal: 10,
    gap: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  title: {
    fontFamily: FontFamily.serifSemiBold,
    fontSize: 22,
    lineHeight: 28,
  },
  headerAction: {
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
  },
  add: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.6,
  },
});
