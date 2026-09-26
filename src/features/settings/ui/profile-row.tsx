import { Pressable, StyleSheet, Text, View } from "react-native";

import { FontFamily, type AppTheme } from "@/constants/theme";
import {
  type CommuteProfile,
  describeProfile,
} from "@/features/settings/domain/settings";

/**
 * A commute profile in a list. "radio" rows pick the active profile;
 * "chevron" rows open the profile to edit it. The active row is tinted
 * with `highlight` (by default the theme's selection tint).
 */
export function ProfileRow({
  theme: t,
  profile,
  active,
  trailing,
  highlight,
  onPress,
  accessibilityHint,
}: {
  theme: AppTheme;
  profile: CommuteProfile;
  active: boolean;
  trailing: "radio" | "chevron";
  highlight?: string;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const description = describeProfile(profile);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={trailing === "radio" ? "radio" : "button"}
      accessibilityState={
        trailing === "radio" ? { checked: active } : { selected: active }
      }
      accessibilityLabel={`${profile.name}${
        active && trailing === "chevron" ? ", in use" : ""
      }, ${description}`}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.row,
        active && { backgroundColor: highlight ?? t.selection },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.name, { color: t.cardInk }]}>
          {profile.name}
          {active && trailing === "chevron" && (
            <Text style={[styles.inUse, { color: t.muted }]}> · In use</Text>
          )}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.description, { color: t.cardInk2 }]}
        >
          {description}
        </Text>
      </View>
      {trailing === "radio" ? (
        <View
          style={[styles.radio, { borderColor: active ? t.cardInk : t.rule }]}
        >
          {active && (
            <View style={[styles.radioDot, { backgroundColor: t.cardInk }]} />
          )}
        </View>
      ) : (
        <Text style={[styles.chevron, { color: t.muted }]}>›</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
  },
  inUse: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
  },
  description: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chevron: {
    fontFamily: FontFamily.sans,
    fontSize: 24,
    lineHeight: 26,
  },
});
