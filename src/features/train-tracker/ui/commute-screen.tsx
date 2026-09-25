import * as Haptics from "expo-haptics";
import { useState } from "react";
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
import {
  FontFamily,
  type Phase,
  PhaseThemes,
  phaseFor,
} from "@/constants/theme";
import { NO_ARRIVALS } from "@/features/train-tracker/domain/arrivals";
import { planCommute } from "@/features/train-tracker/domain/commute";
import { formatClock } from "@/features/train-tracker/domain/time";
import { describeArrivalsError } from "@/features/train-tracker/ui/arrivals-error";
import { HorizonScene } from "@/features/train-tracker/ui/horizon-scene";
import { useArrivals } from "@/features/train-tracker/ui/use-arrivals";
import { useNow } from "@/hooks/use-now";

const GREETING: Record<Phase, string> = {
  dawn: "Good morning",
  midday: "Good afternoon",
  dusk: "Good evening",
  night: "Late one",
};

export function CommuteScreen() {
  const now = useNow();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { data, error, dataUpdatedAt } = useArrivals();

  const phase = phaseFor(new Date(now).getHours());
  const t = PhaseThemes[phase];

  // The picked train sticks until it leaves or is cancelled; planCommute then
  // falls back to the next train.
  const [pickedTripId, setPickedTripId] = useState<string | null>(null);
  const plan = planCommute(now, data ?? NO_ARRIVALS, pickedTripId);

  const select = (tripId: string) => {
    setPickedTripId(tripId);
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

  // Before the first successful fetch, show loading or the error instead.
  const failure = error ? describeArrivalsError(error) : null;
  const hero = data
    ? {
        mins: plan.minsLabel,
        until: plan.arrivalLabel
          ? `until the ${plan.arrivalLabel} reaches Sunnyvale`
          : "due in the next two hours",
      }
    : { mins: failure ? "No trains" : "Checking…", until: null };
  const card = data
    ? { title: plan.leaveTitle, sub: plan.leaveSub }
    : failure
      ? { title: failure.title, sub: failure.detail }
      : { title: "Checking the trains.", sub: "One moment." };

  return (
    <ScrollView
      style={{ backgroundColor: t.card }}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
      alwaysBounceVertical={false}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <HorizonScene phase={phase} trainFront={plan.trainFront} />
        <View style={[styles.hero, { top: Math.max(insets.top + 12, 32) }]}>
          <Text style={[styles.greeting, { color: t.ink2 }]}>
            {GREETING[phase]} · to Britomart
          </Text>
          <Text style={[styles.mins, { color: t.ink }]}>{hero.mins}</Text>
          {hero.until && (
            <Text style={[styles.until, { color: t.ink2 }]}>{hero.until}</Text>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={[styles.leaveTitle, { color: t.cardInk }]}>
          {card.title}
        </Text>
        <Text style={[styles.leaveSub, { color: t.cardInk2 }]}>{card.sub}</Text>
        <View style={[styles.rule, { backgroundColor: t.rule }]} />
        {data && failure && (
          <Text style={[styles.notice, { color: t.muted }]}>
            {failure.title} Showing trains as of {formatClock(dataUpdatedAt)}.
          </Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: "absolute",
    left: 24,
    right: 24,
  },
  greeting: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
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
