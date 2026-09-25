import { useEffect } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, Ellipse, Rect } from "react-native-svg";

import { FontFamily, type Phase, PhaseThemes } from "@/constants/theme";

/** The scene is drawn on a 390×500 canvas and scaled to the screen width. */
const SCENE_W = 390;
const SCENE_H = 500;
const MAX_SCENE_W = 480;

const TRAIN_W = 94;

const ORB: Record<Phase, { x: number; y: number; size: number }> = {
  dawn: { x: 250, y: 196, size: 96 },
  midday: { x: 292, y: 188, size: 60 },
  dusk: { x: 232, y: 285, size: 100 },
  night: { x: 278, y: 196, size: 60 },
};

const CLOUDS = [
  { x: 54, y: 230, w: 84, h: 26 },
  { x: 184, y: 260, w: 110, h: 30 },
  { x: 314, y: 213, w: 60, h: 20 },
];

const STARS = [
  [96, 22, 2],
  [210, 26, 2],
  [330, 44, 3],
  [40, 120, 2],
  [236, 250, 2],
  [150, 210, 2],
  [300, 300, 2],
  [190, 282, 2],
  [360, 156, 2],
  [70, 300, 2],
] as const;

const POSTS = [23, 107, 276];

const STATIONS = [
  { name: "Swanson", x: 12 },
  { name: "Ranui", x: 90 },
  { name: "Sturges Rd", x: 164 },
  { name: "Henderson", x: 248 },
];

type Props = {
  phase: Phase;
  /** x of the train's nose, in scene coordinates. */
  trainFront: number;
};

export function HorizonScene({ phase, trainFront }: Props) {
  const t = PhaseThemes[phase];
  const { width } = useWindowDimensions();
  const sceneWidth = Math.min(width, MAX_SCENE_W);
  const scale = sceneWidth / SCENE_W;
  const orb = ORB[phase];
  const isNight = phase === "night";
  const hasBeam = phase === "dusk" || isNight;

  const front = useSharedValue(trainFront);
  useEffect(() => {
    front.value = withTiming(trainFront, {
      duration: 1000,
      easing: Easing.linear,
    });
  }, [front, trainFront]);
  const trainStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: front.value }],
  }));

  return (
    <View
      style={[
        styles.frame,
        { backgroundColor: t.sky, height: SCENE_H * scale },
      ]}
    >
      <View
        style={[
          styles.canvas,
          {
            width: SCENE_W,
            height: SCENE_H,
            transform: [{ scale }],
            left: (width - sceneWidth) / 2,
          },
        ]}
      >
        <Svg width={SCENE_W} height={SCENE_H} style={StyleSheet.absoluteFill}>
          <Defs>
            <ClipPath id="orb">
              <Circle
                cx={orb.x + orb.size / 2}
                cy={orb.y + orb.size / 2}
                r={orb.size / 2}
              />
            </ClipPath>
          </Defs>
          <Rect width={SCENE_W} height={SCENE_H} fill={t.sky} />
          {isNight &&
            STARS.map(([x, y, r]) => (
              <Circle
                key={`${x}-${y}`}
                cx={x + r / 2}
                cy={y + r / 2}
                r={r / 2}
                fill="#C9CDE4"
                opacity={0.7}
              />
            ))}
          <Circle
            cx={orb.x + orb.size / 2}
            cy={orb.y + orb.size / 2}
            r={orb.size / 2}
            fill={t.orb}
          />
          {isNight && (
            // A sky-coloured disc nudged up-left carves the moon into a crescent.
            <Circle
              cx={orb.x - 14 + orb.size / 2}
              cy={orb.y - 10 + orb.size / 2}
              r={orb.size / 2}
              fill={t.sky}
              clipPath="url(#orb)"
            />
          )}
          {phase === "midday" &&
            CLOUDS.map((c) => (
              <Rect
                key={c.x}
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                rx={c.h / 2}
                fill="#FBFDFE"
              />
            ))}
          <Ellipse cx={150} cy={490} rx={300} ry={190} fill={t.hill1} />
          <Ellipse cx={455} cy={508} rx={250} ry={190} fill={t.hill2} />
          <Rect x={0} y={390} width={SCENE_W} height={110} fill={t.ground} />
          <Rect x={0} y={388} width={SCENE_W} height={3} fill={t.track} />
          {POSTS.map((x) => (
            <Rect key={x} x={x} y={372} width={2} height={17} fill={t.track} />
          ))}
          {/* "You": a rounded-top marker at the end of the line. */}
          <Rect x={352} y={360} width={13} height={29} rx={6.5} fill={t.you} />
          <Rect x={352} y={375} width={13} height={14} rx={2} fill={t.you} />
          {isNight && <Circle cx={358.5} cy={369} r={3} fill="#F7C86A" />}
        </Svg>

        <Animated.View style={[styles.trainTrack, trainStyle]}>
          {hasBeam && (
            <Svg width={62} height={15} style={styles.beam}>
              <Ellipse cx={31} cy={7.5} rx={31} ry={7.5} fill={t.beam} />
            </Svg>
          )}
          <View style={[styles.train, { backgroundColor: t.train }]}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.window, { backgroundColor: t.win }]}
              />
            ))}
            <View
              style={[
                styles.window,
                styles.frontWindow,
                { backgroundColor: t.win },
              ]}
            />
          </View>
        </Animated.View>

        {STATIONS.map((s) => (
          <Text
            key={s.name}
            style={[styles.station, { left: s.x, color: t.label }]}
          >
            {s.name}
          </Text>
        ))}
        <Text style={[styles.station, styles.you, { color: t.label }]}>
          You
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    overflow: "hidden",
  },
  canvas: {
    position: "absolute",
    top: 0,
    transformOrigin: "left top",
  },
  trainTrack: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  beam: {
    position: "absolute",
    left: -6,
    top: 370,
  },
  train: {
    position: "absolute",
    left: -TRAIN_W,
    top: 364,
    width: TRAIN_W,
    height: 24,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 2,
    borderBottomLeftRadius: 2,
    flexDirection: "row",
    gap: 4,
    paddingLeft: 10,
    paddingTop: 6,
  },
  window: {
    width: 9,
    height: 7,
    borderRadius: 1.5,
  },
  frontWindow: {
    width: 18,
    borderTopRightRadius: 6,
  },
  station: {
    position: "absolute",
    top: 403,
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  you: {
    left: 357,
    fontFamily: FontFamily.sansBold,
  },
});
