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
import {
  MAIN_TRAIN,
  planCommute,
} from "@/features/train-tracker/domain/commute";
import { nextArrival } from "@/features/train-tracker/mock/timetable";
import { HorizonScene } from "@/features/train-tracker/ui/horizon-scene";
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

  const phase = phaseFor(new Date(now).getHours());
  const t = PhaseThemes[phase];

  // A picked train only sticks while it belongs to the current set of departures;
  // once the main train arrives the list rolls forward and selection resets.
  const arrival = nextArrival(now);
  const [picked, setPicked] = useState({ arrival, index: MAIN_TRAIN });
  const selected = picked.arrival === arrival ? picked.index : MAIN_TRAIN;
  const plan = planCommute(now, arrival, selected);

  const select = (index: number) => {
    setPicked({ arrival, index });
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

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
          <Text style={[styles.mins, { color: t.ink }]}>{plan.minsLabel}</Text>
          <Text style={[styles.until, { color: t.ink2 }]}>
            until the {plan.arrivalLabel} reaches Sunnyvale
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={[styles.leaveTitle, { color: t.cardInk }]}>
          {plan.leaveTitle}
        </Text>
        <Text style={[styles.leaveSub, { color: t.cardInk2 }]}>
          {plan.leaveSub}
        </Text>
        <View style={[styles.rule, { backgroundColor: t.rule }]} />
        {plan.rows.map((row) => (
          <Pressable
            key={row.index}
            disabled={!row.selectable}
            onPress={() => select(row.index)}
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
  rowText: {
    fontFamily: FontFamily.sans,
    fontSize: 15,
  },
});
