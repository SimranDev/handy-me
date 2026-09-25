import type { Href } from "expo-router";
import {
  TabList,
  TabListProps,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
  Tabs,
} from "expo-router/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily } from "@/constants/theme";
import { useSky } from "@/hooks/use-sky";

type Shape = "circle" | "train" | "tbd";

const TABS: { name: string; href: Href; label: string; shape: Shape }[] = [
  { name: "today", href: "/today", label: "Today", shape: "circle" },
  { name: "index", href: "/", label: "Commute", shape: "train" },
  { name: "tab-3", href: "/tab-3", label: "Tab 3", shape: "tbd" },
  { name: "tab-4", href: "/tab-4", label: "Tab 4", shape: "tbd" },
  { name: "tab-5", href: "/tab-5", label: "Tab 5", shape: "tbd" },
];

const BAR_CONTENT_HEIGHT = 52;

/** Space screens should leave at the bottom so content clears the tab bar. */
export function useTabBarHeight() {
  const { bottom } = useSafeAreaInsets();
  return BAR_CONTENT_HEIGHT + Math.max(bottom, 8);
}

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <TabBar>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton label={tab.label} shape={tab.shape} />
            </TabTrigger>
          ))}
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabBar(props: TabListProps) {
  const { theme } = useSky();
  const height = useTabBarHeight();

  return (
    <View
      {...props}
      style={[
        styles.bar,
        { height, backgroundColor: theme.glass, borderTopColor: theme.rule },
      ]}
    />
  );
}

type TabButtonProps = TabTriggerSlotProps & { label: string; shape: Shape };

function TabButton({ label, shape, isFocused, ...props }: TabButtonProps) {
  const { theme } = useSky();
  const color = isFocused ? theme.cardInk : theme.muted;

  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={styles.tab}
    >
      <View style={styles.iconBox}>
        <TabIcon shape={shape} color={color} filled={!!isFocused} />
      </View>
      <Text
        style={[
          styles.label,
          {
            color,
            fontFamily: isFocused ? FontFamily.sansBold : FontFamily.sansMedium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Placeholder glyphs from the design: a sun, a train, and a dashed diamond for tabs still TBD. */
function TabIcon({
  shape,
  color,
  filled,
}: {
  shape: Shape;
  color: string;
  filled: boolean;
}) {
  if (shape === "tbd") {
    return <View style={[styles.tbd, { borderColor: color }]} />;
  }
  return (
    <View
      style={[
        shape === "circle" ? styles.circle : styles.train,
        { borderColor: color, backgroundColor: filled ? color : "transparent" },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    paddingTop: 8,
    paddingHorizontal: 6,
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    minHeight: 48,
    paddingTop: 4,
  },
  iconBox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10.5,
    letterSpacing: 0.1,
  },
  circle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.8,
  },
  train: {
    width: 22,
    height: 12,
    borderWidth: 1.8,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 1,
    borderBottomLeftRadius: 1,
  },
  tbd: {
    width: 15,
    height: 15,
    borderRadius: 3,
    borderWidth: 1.6,
    borderStyle: "dashed",
    transform: [{ rotate: "45deg" }],
  },
});
