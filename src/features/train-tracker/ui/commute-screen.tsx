import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { router, useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { useTabBarHeight } from "@/components/app-tabs";
import { FontFamily, type PhaseTheme } from "@/constants/theme";
import { greetingFor } from "@/domain/sky";
import { MINUTE } from "@/domain/time";
import {
  activeProfile,
  missingSetup,
} from "@/features/settings/domain/settings";
import { useSettings } from "@/features/settings/store/settings-store";
import { ProfileSwitcher } from "@/features/settings/ui/profile-switcher";
import {
  hasUsableKey,
  useApiKeyState,
} from "@/features/train-tracker/api/api-key";
import { useDataSource } from "@/features/train-tracker/api/data-source";
import {
  type Arrival,
  NO_ARRIVALS,
} from "@/features/train-tracker/domain/arrivals";
import type { CommuteStop } from "@/features/train-tracker/domain/arrivals-source";
import { planCommute } from "@/features/train-tracker/domain/commute";
import { describeArrivalsError } from "@/features/train-tracker/ui/arrivals-error";
import { HorizonScene } from "@/features/train-tracker/ui/horizon-scene";
import { useArrivals } from "@/features/train-tracker/ui/use-arrivals";
import { useUpstreamStations } from "@/features/train-tracker/ui/use-upstream-stations";
import { useAppActive } from "@/hooks/use-app-active";
import { useSky } from "@/hooks/use-sky";

/** Settings opens by itself at most once per launch, so you can still look around. */
let setupPrompted = false;

/** Stand-in stop for the mock data source when no station is chosen yet. */
const MOCK_STOP: CommuteStop = { stopCode: "mock", directionId: null };

export function CommuteScreen() {
  const { now, sky, theme: t } = useSky(1000);
  const isFocused = useIsFocused();
  const appActive = useAppActive();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const dataSource = useDataSource();
  const settingsState = useSettings();
  const keyState = useApiKeyState();
  const settings =
    settingsState.status === "ready" ? settingsState.settings : null;
  const profile = settings ? activeProfile(settings) : null;
  const station = profile?.station ?? null;
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const setupKnown = settings != null && keyState.status !== "loading";
  const missing = setupKnown
    ? missingSetup(dataSource, hasUsableKey(keyState), station)
    : [];

  // First launch without a key or station: open Settings to explain.
  useEffect(() => {
    if (!setupKnown || missing.length === 0 || setupPrompted) return;
    setupPrompted = true;
    router.navigate("/settings");
  }, [setupKnown, missing.length]);

  const stop: CommuteStop | null = station
    ? { stopCode: station.stopCode, directionId: station.directionId }
    : dataSource === "mock"
      ? MOCK_STOP
      : null;
  const { data, error, dataUpdatedAt } = useArrivals(
    stop,
    setupKnown && missing.length === 0,
  );

  // The picked train sticks until it leaves or is cancelled; planCommute then
  // falls back to the next train.
  const [pickedTripId, setPickedTripId] = useState<string | null>(null);
  const plan = planCommute(now, data ?? NO_ARRIVALS, {
    pickedTripId,
    walkMinutes: profile?.walkMinutes ?? 0,
    stationName: station?.stationName ?? "your stop",
  });
  const listed = data
    ? [data.next, ...data.afterNext, data.justDeparted].filter(
        (a): a is Arrival => a != null,
      )
    : [];
  const target = listed.find((a) => a.tripId === plan.targetTripId) ?? null;
  const stations = useUpstreamStations(stop, target ?? listed[0] ?? null);

  // One nudge when it's time to leave for the planned train, at most once per train.
  const nudgedTrips = useRef(new Set<string>());
  useEffect(() => {
    const tripId = plan.targetTripId;
    if (Platform.OS === "web" || plan.leaveMinutes !== 0 || !tripId) return;
    if (nudgedTrips.current.has(tripId)) return;
    nudgedTrips.current.add(tripId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [plan.leaveMinutes, plan.targetTripId]);

  const horn = useAudioPlayer(require("@/assets/sounds/train-horn.mp3"));
  const honk = () => {
    // Restart from the top so rapid taps each sound the horn.
    horn.seekTo(0);
    horn.play();
  };

  const select = (tripId: string) => {
    setPickedTripId(tripId);
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

  // Setup first; then, before the first successful fetch, loading or the error.
  const failure = error ? describeArrivalsError(error) : null;
  const setup = missing.includes("key")
    ? {
        title: "Add your AT API key.",
        sub: "Live trains need a free Auckland Transport API key, saved securely on this phone.",
      }
    : missing.includes("station")
      ? {
          title: "Choose your station.",
          sub: "Pick your station and platform, and the trains will show here.",
        }
      : null;
  const hero = setup
    ? { mins: "Set up", until: "in Settings" }
    : data
      ? { mins: plan.minsLabel, until: plan.untilLabel }
      : { mins: failure ? "No trains" : "Checking…", until: null };
  const card = setup
    ? { ...setup, settingsLink: true }
    : data
      ? { title: plan.leaveTitle, sub: plan.leaveSub, settingsLink: false }
      : failure
        ? {
            title: failure.title,
            sub: failure.detail,
            settingsLink: failure.needsSettings,
          }
        : {
            title: "Checking the trains.",
            sub: "One moment.",
            settingsLink: false,
          };
  const staleNotice =
    !setup && data && failure ? failure.staleNotice(now - dataUpdatedAt) : null;
  const destination = profile?.destinationLabel;
  const showSource = dataSource === "live" && !setup && target != null;

  return (
    <ScrollView
      style={{ backgroundColor: t.card }}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
      alwaysBounceVertical={false}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <HorizonScene
          sky={sky}
          theme={t}
          train={
            !setup && plan.targetTripId && plan.targetEtaMs != null
              ? { tripId: plan.targetTripId, etaMs: plan.targetEtaMs }
              : null
          }
          stations={setup ? [] : stations}
          dueSoon={
            plan.targetEtaMs != null &&
            plan.targetEtaMs - now <= MINUTE &&
            plan.targetEtaMs - now > -30_000
          }
          active={isFocused && appActive}
          accessibilityLabel={
            data && !setup
              ? plan.sceneLabel
              : `${hero.mins} ${hero.until ?? ""}`.trim()
          }
          onTrainPress={honk}
        />
        <View style={[styles.hero, { top: Math.max(insets.top + 12, 32) }]}>
          <View style={styles.greetingRow}>
            <Text style={[styles.greeting, { color: t.ink2 }]}>
              {greetingFor(sky.phase, now)}
              {destination ? ` · to ${destination}` : ""}
            </Text>
            {showSource && target && (
              <SourceBadge live={target.source === "live"} theme={t} />
            )}
          </View>
          <Text style={[styles.mins, { color: t.ink }]}>{hero.mins}</Text>
          {hero.until && (
            <Text style={[styles.until, { color: t.ink2 }]}>{hero.until}</Text>
          )}
        </View>
        {profile && (
          <ProfilePill
            name={profile.name}
            theme={t}
            onPress={() => setSwitcherOpen(true)}
          />
        )}
      </View>

      <View style={styles.card}>
        <Text style={[styles.leaveTitle, { color: t.cardInk }]}>
          {card.title}
        </Text>
        <Text style={[styles.leaveSub, { color: t.cardInk2 }]}>{card.sub}</Text>
        {card.settingsLink && <SettingsLink theme={t} />}
        <View style={[styles.rule, { backgroundColor: t.rule }]} />
        {staleNotice && (
          <View style={styles.noticeRow}>
            <Text style={[styles.notice, { color: t.muted }]}>
              {staleNotice}
            </Text>
            {failure?.needsSettings && <SettingsLink theme={t} compact />}
          </View>
        )}
        {plan.rows.map((row) => (
          <Pressable
            key={row.tripId}
            disabled={!row.selectable}
            onPress={() => select(row.tripId)}
            accessibilityRole="button"
            accessibilityLabel={`${row.time}, ${row.status}`}
            accessibilityHint={
              row.selectable ? "Plan around this train" : undefined
            }
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text
              style={[
                styles.rowText,
                { color: row.selectable ? t.cardInk : t.muted },
              ]}
            >
              {row.time}
            </Text>
            <Text
              style={[
                styles.rowText,
                {
                  color:
                    row.tone === "late"
                      ? t.late
                      : row.tone === "muted"
                        ? t.muted
                        : t.cardInk2,
                },
              ]}
            >
              {row.status}
            </Text>
          </Pressable>
        ))}
      </View>

      {settings && (
        <ProfileSwitcher
          visible={switcherOpen}
          onClose={() => setSwitcherOpen(false)}
          settings={settings}
          theme={t}
        />
      )}
    </ScrollView>
  );
}

/** Whether the countdown comes from realtime data or only the timetable. */
function SourceBadge({ live, theme: t }: { live: boolean; theme: PhaseTheme }) {
  return (
    <View
      accessible
      accessibilityLabel={
        live ? "Live times" : "Scheduled times, no live data for this train"
      }
      style={[styles.badge, { borderColor: t.ink2 }]}
    >
      {live && <View style={[styles.liveDot, { backgroundColor: t.ink }]} />}
      <Text style={[styles.badgeText, { color: t.ink2 }]}>
        {live ? "Live" : "Scheduled"}
      </Text>
    </View>
  );
}

/** The commute in use; opens the sheet to switch, edit or add one. */
function ProfilePill({
  name,
  theme: t,
  onPress,
}: {
  name: string;
  theme: PhaseTheme;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Commute profile: ${name}`}
      accessibilityHint="Switch, edit or add a commute profile"
      hitSlop={8}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: t.card },
        pressed && styles.pillPressed,
      ]}
    >
      <View style={[styles.pillDot, { backgroundColor: t.cardInk }]} />
      <Text numberOfLines={1} style={[styles.pillText, { color: t.cardInk }]}>
        {name}
      </Text>
      <Svg width={12} height={8} viewBox="0 0 12 8">
        <Path
          d="M1 1.5l5 5 5-5"
          stroke={t.cardInk}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );
}

function SettingsLink({
  theme: t,
  compact = false,
}: {
  theme: PhaseTheme;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={() => router.navigate("/settings")}
      accessibilityRole="link"
      hitSlop={8}
      style={({ pressed }) => [
        compact ? styles.linkCompact : styles.link,
        { borderColor: t.cardInk },
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={[styles.linkText, { color: t.cardInk }]}>Open Settings</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: "absolute",
    left: 24,
    right: 24,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  greeting: {
    flexShrink: 1,
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9,
    borderWidth: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    lineHeight: 16,
  },
  pill: {
    position: "absolute",
    right: 16,
    bottom: 14,
    maxWidth: "60%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillPressed: {
    opacity: 0.8,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  pillText: {
    flexShrink: 1,
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
  },
  link: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  linkCompact: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  linkText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
  },
  mins: {
    fontFamily: FontFamily.serif,
    fontSize: 62,
    lineHeight: 65,
    letterSpacing: -1,
    marginTop: 14,
  },
  until: {
    fontFamily: FontFamily.serif,
    fontSize: 21,
    lineHeight: 27,
    marginTop: 6,
  },
  card: {
    paddingTop: 30,
    paddingHorizontal: 24,
  },
  leaveTitle: {
    fontFamily: FontFamily.serifSemiBold,
    fontSize: 27,
    lineHeight: 32,
  },
  leaveSub: {
    fontFamily: FontFamily.sans,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  rule: {
    height: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 30,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  rowPressed: {
    backgroundColor: "rgba(127,127,127,0.08)",
  },
  noticeRow: {
    gap: 2,
  },
  notice: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  rowText: {
    fontFamily: FontFamily.sans,
    fontSize: 15,
  },
});
