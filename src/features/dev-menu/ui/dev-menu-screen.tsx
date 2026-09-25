import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily, type PhaseTheme } from "@/constants/theme";
import { aucklandParts, formatClock, HOUR, MINUTE } from "@/domain/time";
import { skyPresets } from "@/features/dev-menu/domain/sky-presets";
import {
  type DataSource,
  ENV_DATA_SOURCE,
  setDataSource,
  useDataSource,
} from "@/features/train-tracker/api/data-source";
import {
  clearSkyPreview,
  pauseSkyPreview,
  PLAY_DAY_MS,
  playSkyPreview,
  previewSkyAt,
  useSkyPreview,
} from "@/hooks/sky-preview";
import { useSky } from "@/hooks/use-sky";

const DATA_SOURCES: { value: DataSource; label: string; sub: string }[] = [
  { value: "mock", label: "Mock", sub: "Built-in timetable" },
  { value: "live", label: "Live", sub: "Auckland Transport" },
];

const NUDGES = [
  { label: "−1 h", ms: -HOUR },
  { label: "−15 min", ms: -15 * MINUTE },
  { label: "+15 min", ms: 15 * MINUTE },
  { label: "+1 h", ms: HOUR },
];

/** Hidden tools for checking the app's looks. Opened by long-pressing the Commute tab. */
export function DevMenuScreen() {
  const { now, sky, theme: t } = useSky(1000);
  const preview = useSkyPreview();
  const dataSource = useDataSource();
  const insets = useSafeAreaInsets();

  const shown = preview.at ?? now;
  const presets = skyPresets(aucklandParts(shown).date);

  const tap = (action: () => void) => () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    action();
  };
  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  return (
    <ScrollView
      style={{ backgroundColor: t.card }}
      contentContainerStyle={[
        styles.content,
        {
          // iOS shows this as a sheet below the status bar; Android goes full screen.
          paddingTop: Platform.OS === "ios" ? 24 : insets.top + 16,
          paddingBottom: insets.bottom + 32,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.cardInk }]}>Dev menu</Text>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          hitSlop={12}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={[styles.done, { color: t.cardInk }]}>Done</Text>
        </Pressable>
      </View>

      <View style={[styles.sky, { backgroundColor: t.sky }]}>
        <View style={[styles.orb, { backgroundColor: t.orb }]} />
        <Text style={[styles.clock, { color: t.ink }]}>
          {formatClock(shown)}
        </Text>
        <Text style={[styles.skyNote, { color: t.ink2 }]}>
          {capitalise(sky.phase)} ·{" "}
          {preview.playing
            ? "playing"
            : preview.at != null
              ? "preview"
              : "real time"}
        </Text>
      </View>

      <Section title="Jump to" theme={t}>
        <View style={styles.grid}>
          {presets.map((preset) => (
            <Chip
              key={preset.label}
              theme={t}
              label={preset.label}
              sub={formatClock(preset.at)}
              selected={preview.at === preset.at}
              style={styles.gridChip}
              onPress={tap(() => previewSkyAt(preset.at))}
            />
          ))}
        </View>
      </Section>

      <Section title="Nudge" theme={t}>
        <View style={styles.row}>
          {NUDGES.map((nudge) => (
            <Chip
              key={nudge.label}
              theme={t}
              label={nudge.label}
              style={styles.rowChip}
              onPress={tap(() => previewSkyAt(shown + nudge.ms))}
            />
          ))}
        </View>
      </Section>

      <Section title="Play" theme={t}>
        <Chip
          theme={t}
          label={preview.playing ? "Pause" : "Play a day"}
          sub={
            preview.playing
              ? "Hold the sky where it is"
              : `24 hours in ${PLAY_DAY_MS / 1000} s, from the time shown`
          }
          selected={preview.playing}
          onPress={tap(preview.playing ? pauseSkyPreview : playSkyPreview)}
        />
      </Section>

      <Chip
        theme={t}
        label="Use real time"
        disabled={preview.at == null}
        onPress={tap(clearSkyPreview)}
      />

      <Text style={[styles.footnote, { color: t.muted }]}>
        Previews only change the sky and colours. Train times stay real. Closing
        the app returns to real time.
      </Text>

      <Section title="Train data" theme={t}>
        <View style={styles.row}>
          {DATA_SOURCES.map((source) => (
            <Chip
              key={source.value}
              theme={t}
              label={source.label}
              sub={source.sub}
              selected={dataSource === source.value}
              style={styles.rowChip}
              onPress={tap(() => setDataSource(source.value))}
            />
          ))}
        </View>
      </Section>

      <Text style={[styles.footnote, { color: t.muted }]}>
        Live needs an API key and a station in Settings. Closing the app returns
        to the .env default ({ENV_DATA_SOURCE}).
      </Text>
    </ScrollView>
  );
}

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: PhaseTheme;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({
  theme,
  label,
  sub,
  selected = false,
  disabled = false,
  style,
  onPress,
}: {
  theme: PhaseTheme;
  label: string;
  sub?: string;
  selected?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: theme.rule,
          backgroundColor: selected ? theme.cardInk : "transparent",
        },
        style,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? theme.card : theme.cardInk },
        ]}
      >
        {label}
      </Text>
      {sub && (
        <Text
          style={[
            styles.chipSub,
            { color: selected ? theme.card : theme.cardInk2 },
          ]}
        >
          {sub}
        </Text>
      )}
    </Pressable>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    gap: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 34,
    lineHeight: 38,
  },
  done: {
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
  },
  sky: {
    borderRadius: 18,
    padding: 20,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    top: 18,
    right: 22,
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  clock: {
    fontFamily: FontFamily.serif,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1,
  },
  skyNote: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  gridChip: {
    flexGrow: 1,
    flexBasis: "30%",
  },
  rowChip: {
    flex: 1,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  chip: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 15,
  },
  chipSub: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
  footnote: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
  },
});
