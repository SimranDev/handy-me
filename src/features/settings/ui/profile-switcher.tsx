import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/bottom-sheet";
import { FontFamily, type AppTheme } from "@/constants/theme";
import {
  canAddProfile,
  type Settings,
  switchProfile,
} from "@/features/settings/domain/settings";
import { updateSettings } from "@/features/settings/store/settings-store";
import { startNewProfile } from "@/features/settings/ui/new-profile";
import { ProfileRow } from "@/features/settings/ui/profile-row";

/** Bottom sheet on the Commute screen: switch, edit or add a commute profile. */
export function ProfileSwitcher({
  visible,
  onClose,
  settings,
  theme: t,
}: {
  visible: boolean;
  onClose: () => void;
  settings: Settings;
  theme: AppTheme;
}) {
  const [editing, setEditing] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setEditing(false);
  }

  // Opening the editor waits until the sheet has slid away, so the editor
  // isn't shown underneath it.
  const afterClose = useRef<(() => void) | null>(null);
  const closeThen = (action: () => void) => {
    afterClose.current = action;
    onClose();
  };

  const choose = (id: string) => {
    if (editing) {
      closeThen(() => router.push({ pathname: "/profile", params: { id } }));
      return;
    }
    if (id !== settings.activeProfileId) {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      updateSettings((s) => switchProfile(s, id));
    }
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        afterClose.current = null;
        onClose();
      }}
      onDismissed={() => {
        const action = afterClose.current;
        afterClose.current = null;
        action?.();
      }}
      theme={t}
      accessibilityLabel="Commute profile"
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

      <View
        accessibilityRole={editing ? undefined : "radiogroup"}
        style={styles.list}
      >
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
          onPress={() => closeThen(startNewProfile)}
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  title: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 22,
    lineHeight: 28,
  },
  headerAction: {
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
  },
  list: {
    gap: 6,
  },
  add: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1.5,
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
