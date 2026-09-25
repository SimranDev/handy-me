import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

import { FontFamily, type PhaseTheme } from "@/constants/theme";

export function Section({
  title,
  theme: t,
  children,
}: {
  title: string;
  theme: PhaseTheme;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: t.muted }]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

type ButtonProps = {
  theme: PhaseTheme;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "link" | "danger";
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
};

export function Button({
  theme: t,
  label,
  onPress,
  variant = "secondary",
  disabled = false,
  busy = false,
  accessibilityHint,
}: ButtonProps) {
  const primary = variant === "primary";
  const plain = variant === "link" || variant === "danger";
  const color = primary ? t.card : variant === "danger" ? t.late : t.cardInk;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole={variant === "link" ? "link" : "button"}
      accessibilityState={{ disabled: disabled || busy, busy }}
      accessibilityHint={accessibilityHint}
      hitSlop={plain ? 10 : 4}
      style={({ pressed }) => [
        plain ? styles.plain : styles.button,
        !plain && {
          borderColor: t.cardInk,
          backgroundColor: primary ? t.cardInk : "transparent",
        },
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy && <ActivityIndicator size="small" color={color} />}
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function TextField({
  theme: t,
  invalid = false,
  style,
  ...props
}: TextInputProps & { theme: PhaseTheme; invalid?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={t.muted}
      selectionColor={t.cardInk}
      {...props}
      style={[
        styles.field,
        { color: t.cardInk, borderColor: invalid ? t.late : t.rule },
        style,
      ]}
    />
  );
}

export function Note({
  theme: t,
  tone = "muted",
  children,
}: {
  theme: PhaseTheme;
  tone?: "muted" | "error";
  children: ReactNode;
}) {
  return (
    <Text
      accessibilityLiveRegion={tone === "error" ? "polite" : "none"}
      style={[styles.note, { color: tone === "error" ? t.late : t.muted }]}
    >
      {children}
    </Text>
  );
}

export const controlStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  value: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 17,
  },
  valueSub: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  title: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
  },
  button: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  plain: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  buttonText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 15,
  },
  field: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: FontFamily.sans,
    fontSize: 16,
  },
  note: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
