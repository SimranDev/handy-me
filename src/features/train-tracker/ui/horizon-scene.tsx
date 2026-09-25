import { useEffect } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Rect,
} from "react-native-svg";

import { FontFamily, type PhaseTheme } from "@/constants/theme";
import type { Sky } from "@/domain/sky";
import {
  INITIAL_MOTION,
  stepTrainMotion,
  type TrainMotion,
} from "@/features/train-tracker/domain/train-track";

/** The scene is drawn on a 390×500 canvas and scaled to the screen width. */
const SCENE_W = 390;
const SCENE_H = 500;
const MAX_SCENE_W = 480;

const TRAIN_W = 94;

/**
 * Sun and moon travel an arc from the right (east, rising) to the left
 * (west, setting); centre coordinates. Below-horizon positions sink behind
 * the hills. The peak stays below the hero text (which ends around y 210).
 */
const ARC = { fromX: 330, toX: 45, horizonY: 355, peakY: 255 };
const MOON_SIZE = 60;

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

/** Centre of the "You" marker, for the arrival pulse. */
const YOU = { x: 358.5, y: 374.5 };

/** Speed (pt/ms) at which the bob reaches full height; ~a typical run. */
const BOB_FULL_SPEED = 0.0005;

type Props = {
  sky: Sky;
  /** Palette blended for `sky.progress`. */
  theme: PhaseTheme;
  /** The train the countdown is about; null when there is none. */
  train: { tripId: string; etaMs: number } | null;
  /** Pulse "You" when the train is due within a minute. */
  dueSoon: boolean;
  /** Run animations only while the screen is focused and the app is foregrounded. */
  active: boolean;
  accessibilityLabel: string;
};

function arcPoint(t: number) {
  return {
    x: ARC.fromX + (ARC.toX - ARC.fromX) * t,
    y: ARC.horizonY - (ARC.horizonY - ARC.peakY) * Math.sin(Math.PI * t),
  };
}

export function HorizonScene({
  sky,
  theme: t,
  train,
  dueSoon,
  active,
  accessibilityLabel,
}: Props) {
  const { width } = useWindowDimensions();
  const sceneWidth = Math.min(width, MAX_SCENE_W);
  const scale = sceneWidth / SCENE_W;
  const reduceMotion = useReducedMotion();

  // Larger near the horizon, smaller overhead, like the original palettes.
  const sun =
    sky.sun == null
      ? null
      : {
          ...arcPoint(sky.sun),
          r: (60 + 40 * (1 - Math.max(0, Math.sin(Math.PI * sky.sun)))) / 2,
        };
  const moon =
    sky.moon == null ? null : { ...arcPoint(sky.moon), r: MOON_SIZE / 2 };

  // --- Train: position computed every frame on the UI thread. ---
  const tripId = useSharedValue<string | null>(train?.tripId ?? null);
  const etaMs = useSharedValue(train?.etaMs ?? Number.NaN);
  const reduce = useSharedValue(reduceMotion);
  const motion = useSharedValue<TrainMotion>(INITIAL_MOTION);
  const bobAmount = useSharedValue(0);
  const bobY = useSharedValue(0);

  useEffect(() => {
    tripId.set(train?.tripId ?? null);
    etaMs.set(train?.etaMs ?? Number.NaN);
  }, [train?.tripId, train?.etaMs, tripId, etaMs]);
  useEffect(() => reduce.set(reduceMotion), [reduceMotion, reduce]);

  const frame = useFrameCallback((info) => {
    "worklet";
    const prev = motion.value;
    const next = stepTrainMotion(
      prev,
      tripId.value,
      etaMs.value,
      Date.now(),
      reduce.value,
    );
    motion.value = next;

    // A gentle bob that grows with speed and settles when the train stops.
    const dt = info.timeSincePreviousFrame ?? 0;
    const speed =
      dt > 0 && dt < 100 && next.tripId === prev.tripId
        ? (next.x - prev.x) / dt
        : 0;
    const target = reduce.value ? 0 : Math.min(1, speed / BOB_FULL_SPEED);
    const amount = bobAmount.value + (target - bobAmount.value) * 0.05;
    bobAmount.value = amount < 0.001 ? 0 : amount;
    bobY.value =
      Math.sin((info.timestamp / 1000) * Math.PI * 2 * 1.6) *
      0.8 *
      bobAmount.value;
  }, false);

  useEffect(() => {
    frame.setActive(active);
  }, [active, frame]);

  const trainStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: motion.value.x }, { translateY: bobY.value }],
  }));

  // --- "You" pulse when the train is due. ---
  const pulsing = dueSoon && active && !reduceMotion;
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (pulsing) {
      pulse.set(
        withRepeat(
          withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(pulse);
      pulse.set(0);
    }
  }, [pulsing, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulsing ? (1 - pulse.value) * 0.6 : 0,
    transform: [{ scale: 1 + pulse.value * 1.4 }],
  }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
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
          {moon && (
            <Defs>
              <ClipPath id="moon">
                <Circle cx={moon.x} cy={moon.y} r={moon.r} />
              </ClipPath>
            </Defs>
          )}
          <Rect width={SCENE_W} height={SCENE_H} fill={t.sky} />
          <G opacity={sky.night * 0.7}>
            {STARS.map(([x, y, r]) => (
              <Circle
                key={`${x}-${y}`}
                cx={x + r / 2}
                cy={y + r / 2}
                r={r / 2}
                fill="#C9CDE4"
              />
            ))}
          </G>
          {sun && <Circle cx={sun.x} cy={sun.y} r={sun.r} fill={t.orb} />}
          {moon && (
            <G opacity={sky.night}>
              <Circle cx={moon.x} cy={moon.y} r={moon.r} fill={t.orb} />
              {/* A sky-coloured disc nudged up-left carves the crescent. */}
              <Circle
                cx={moon.x - 14}
                cy={moon.y - 10}
                r={moon.r}
                fill={t.sky}
                clipPath="url(#moon)"
              />
            </G>
          )}
          <G opacity={sky.clouds}>
            {CLOUDS.map((c) => (
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
          </G>
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
          <Circle
            cx={358.5}
            cy={369}
            r={3}
            fill="#F7C86A"
            opacity={sky.night}
          />
        </Svg>

        <Animated.View
          pointerEvents="none"
          style={[styles.pulse, { borderColor: t.you }, pulseStyle]}
        />

        <Animated.View style={[styles.trainTrack, trainStyle]}>
          <View style={[styles.beam, { opacity: sky.lights }]}>
            <Svg width={62} height={15}>
              <Ellipse cx={31} cy={7.5} rx={31} ry={7.5} fill={t.beam} />
            </Svg>
          </View>
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
  pulse: {
    position: "absolute",
    left: YOU.x - 15,
    top: YOU.y - 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
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
