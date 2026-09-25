import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";

import { Fonts, FontFamily } from "@/constants/theme";
import { useSky } from "@/hooks/use-sky";

type Props = {
  title: string;
  note: string;
};

/** Stand-in for tabs whose feature hasn't been designed yet. */
export function PlaceholderScreen({ title, note }: Props) {
  const { theme } = useSky();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.card,
          paddingTop: Math.max(insets.top + 17, 64),
        },
      ]}
    >
      <Text style={[styles.app, { color: theme.muted }]}>Me Simplified</Text>
      <Text style={[styles.title, { color: theme.cardInk }]}>{title}</Text>
      <View style={[styles.box, { borderColor: theme.rule }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id="hatch"
              patternUnits="userSpaceOnUse"
              width={11}
              height={11}
              patternTransform="rotate(45)"
            >
              <Line
                x1={10.5}
                y1={0}
                x2={10.5}
                y2={11}
                stroke={theme.stripe}
                strokeWidth={1}
              />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#hatch)" />
        </Svg>
        <Text style={[styles.note, { color: theme.muted }]}>{note}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 18,
  },
  app: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 44,
    lineHeight: 46,
  },
  box: {
    height: 420,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
});
