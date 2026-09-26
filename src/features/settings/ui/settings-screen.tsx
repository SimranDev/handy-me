import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import type { ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTabBarHeight } from "@/components/app-tabs";
import { FontFamily, type AppTheme } from "@/constants/theme";
import {
  activeProfile,
  type AppearancePreference,
  type CommuteProfile,
  missingSetup,
  type Settings,
  setAppearance,
  type SetupStep,
} from "@/features/settings/domain/settings";
import {
  updateSettings,
  useSettings,
} from "@/features/settings/store/settings-store";
import {
  type ApiKeyState,
  hasUsableKey,
  useApiKeyState,
} from "@/features/train-tracker/api/api-key";
import { useDataSource } from "@/features/train-tracker/api/data-source";
import { useSky } from "@/hooks/use-sky";

/** The Settings list: what's left to set up, then a row for each page. */
export function SettingsScreen() {
  const { theme: t, appearance } = useSky();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const dataSource = useDataSource();
  const settingsState = useSettings();
  const keyState = useApiKeyState();

  const settings =
    settingsState.status === "ready" ? settingsState.settings : null;
  const profile = settings ? activeProfile(settings) : null;
  const hasKey = hasUsableKey(keyState);
  const missing =
    profile && keyState.status !== "loading"
      ? missingSetup(dataSource, hasKey, profile.station)
      : [];

  return (
    <ScrollView
      style={{ backgroundColor: t.card }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top + 17, 64),
          paddingBottom: tabBarHeight + 32,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.app, { color: t.muted }]}>Handy Me</Text>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: t.cardInk }]}
        >
          Settings
        </Text>
      </View>

      {profile && missing.length > 0 && (
        <FinishSetup
          theme={t}
          rule={
            appearance === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"
          }
          missing={missing}
          profile={profile}
        />
      )}

      <Group theme={t} title="Commute">
        <GroupRow
          theme={t}
          label="Commute profiles"
          sub={settings && profile ? describeProfiles(settings, profile) : ""}
          attention={missing.includes("station")}
          href="/settings/profiles"
        />
      </Group>

      <Group theme={t} title="Live data">
        <GroupRow
          theme={t}
          label="Auckland Transport API key"
          sub={describeKey(keyState)}
          attention={missing.includes("key")}
          href="/settings/api-key"
        />
      </Group>

      {settings && (
        <Group
          theme={t}
          title="App"
          note="The sky on the Commute screen always follows the time of day."
        >
          <AppearancePicker theme={t} value={settings.appearance} />
        </Group>
      )}
    </ScrollView>
  );
}

function describeProfiles(settings: Settings, profile: CommuteProfile) {
  if (!profile.station) return "Station not chosen yet";
  const count = settings.profiles.length;
  return `${profile.name} in use · ${count} profile${count === 1 ? "" : "s"}`;
}

function describeKey(keyState: ApiKeyState) {
  switch (keyState.status) {
    case "loading":
      return "";
    case "saved":
      return "Saved";
    case "dev":
      return "Using the key from .env";
    case "absent":
      // Secure store doesn't work in browsers, so a key can't be saved on web.
      return Platform.OS === "web"
        ? "Can’t be saved in a browser"
        : "Not added yet";
  }
}

/** Open the editor for the profile in use, over the list of profiles. */
function chooseStation(profile: CommuteProfile) {
  router.push("/settings/profiles");
  router.push({ pathname: "/profile", params: { id: profile.id } });
}

function FinishSetup({
  theme: t,
  rule,
  missing,
  profile,
}: {
  theme: AppTheme;
  rule: string;
  missing: SetupStep[];
  profile: CommuteProfile;
}) {
  const needsKey = missing.includes("key");
  const steps = [
    {
      label: "Add your free AT API key",
      done: !needsKey,
      onPress: () => router.push("/settings/api-key"),
    },
    {
      label: "Choose the station you leave from",
      done: !missing.includes("station"),
      onPress: () => chooseStation(profile),
    },
  ];

  return (
    <View style={[styles.setup, { backgroundColor: t.soft }]}>
      <Text
        accessibilityRole="header"
        style={[styles.setupTitle, { color: t.cardInk }]}
      >
        Finish setting up
      </Text>
      <Text style={[styles.setupBody, { color: t.cardInk2 }]}>
        {missing.length === 1 ? "One step left" : "Two quick steps"} to see when
        to leave for your train.
        {needsKey && " Your key stays on this phone."}
      </Text>
      {steps.map((step) => (
        <Pressable
          key={step.label}
          onPress={step.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${step.label}${step.done ? ", done" : ""}`}
          style={({ pressed }) => [
            styles.step,
            { borderTopColor: rule },
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.check,
              {
                borderColor: t.cardInk,
                backgroundColor: step.done ? t.cardInk : "transparent",
              },
            ]}
          >
            {step.done && (
              <View style={[styles.tick, { borderColor: t.soft }]} />
            )}
          </View>
          <Text
            style={[
              styles.stepLabel,
              { color: t.cardInk },
              step.done && styles.stepDone,
            ]}
          >
            {step.label}
          </Text>
          <Text style={[styles.chevron, { color: t.cardInk2 }]}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Group({
  theme: t,
  title,
  note,
  children,
}: {
  theme: AppTheme;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text
        accessibilityRole="header"
        style={[styles.groupTitle, { color: t.muted }]}
      >
        {title}
      </Text>
      <View style={[styles.groupCard, { borderColor: t.rule }]}>
        {children}
      </View>
      {note && (
        <Text style={[styles.groupNote, { color: t.muted }]}>{note}</Text>
      )}
    </View>
  );
}

const APPEARANCE_OPTIONS: { value: AppearancePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Light or dark app surfaces, or whichever the phone is using. */
function AppearancePicker({
  theme: t,
  value,
}: {
  theme: AppTheme;
  value: AppearancePreference;
}) {
  const choose = (next: AppearancePreference) => {
    if (next === value) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    updateSettings((s) => setAppearance(s, next));
  };

  return (
    <View style={styles.appearance}>
      <Text style={[styles.rowLabel, { color: t.cardInk }]}>Appearance</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Appearance"
        style={[styles.segments, { backgroundColor: t.soft }]}
      >
        {APPEARANCE_OPTIONS.map((option) => {
          const on = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => choose(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityHint={
                option.value === "system" ? "Match your phone" : undefined
              }
              style={({ pressed }) => [
                styles.segment,
                on && [styles.segmentOn, { backgroundColor: t.card }],
                pressed && !on && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: on ? t.cardInk : t.cardInk2 },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A row that opens a Settings page. `attention` marks something to fix. */
function GroupRow({
  theme: t,
  label,
  sub,
  attention,
  href,
}: {
  theme: AppTheme;
  label: string;
  sub: string;
  attention: boolean;
  href: Href;
}) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: t.cardInk }]}>{label}</Text>
        {sub !== "" && (
          <Text
            numberOfLines={1}
            style={[styles.rowSub, { color: attention ? t.late : t.cardInk2 }]}
          >
            {sub}
          </Text>
        )}
      </View>
      {attention && <View style={[styles.dot, { backgroundColor: t.late }]} />}
      <Text style={[styles.chevron, { color: t.muted }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    gap: 26,
  },
  header: {
    gap: 18,
  },
  app: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
  },
  title: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 44,
    lineHeight: 46,
  },
  setup: {
    borderRadius: 18,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  setupTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 20,
    lineHeight: 25,
  },
  setupBody: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    borderTopWidth: 1,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    alignItems: "center",
    justifyContent: "center",
  },
  tick: {
    width: 5,
    height: 9,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ translateY: -1 }, { rotate: "45deg" }],
  },
  stepLabel: {
    flex: 1,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
  },
  stepDone: {
    textDecorationLine: "line-through",
    opacity: 0.55,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    paddingLeft: 4,
  },
  groupNote: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 4,
  },
  appearance: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  segments: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  segmentOn: {
    boxShadow: "0 1px 3px rgba(0,0,0,0.14)",
  },
  segmentText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 62,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowPressed: {
    backgroundColor: "rgba(127,127,127,0.08)",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
  },
  rowSub: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chevron: {
    fontFamily: FontFamily.sans,
    fontSize: 22,
  },
  pressed: {
    opacity: 0.6,
  },
});
