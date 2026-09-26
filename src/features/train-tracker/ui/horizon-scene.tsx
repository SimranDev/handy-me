import { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
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
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { FontFamily, type AppTheme } from "@/constants/theme";
import type { Sky } from "@/domain/sky";
import {
  INITIAL_MOTION,
  stepTrainMotion,
  type TrainMotion,
} from "@/features/train-tracker/domain/train-track";
import {
  INITIAL_RIDE,
  stepTrainRide,
  type TrainRide,
} from "@/features/train-tracker/domain/train-ride";
import { trainShadow } from "@/features/train-tracker/domain/train-shadow";
import {
  TRAIN_H,
  TRAIN_W,
  TrainSprite,
} from "@/features/train-tracker/ui/train-sprite";

/** The scene is drawn on a 390×500 canvas and scaled to the screen width. */
const SCENE_W = 390;
const SCENE_H = 500;
const MAX_SCENE_W = 480;

/** Top of the train sprite (its pantograph); the body sits on the track. */
const TRAIN_Y = 352;

/**
 * The headlight: a cone from the nose that widens ahead and fades out.
 * Train coordinates (0,0 is the sprite's top-left corner).
 */
const BEAM = { x: TRAIN_W - 1, y: 12, w: 70, h: 21 };
const BEAM_POINTS = `0,8.5 ${BEAM.w},0.7 ${BEAM.w},20.3 0,12.5`;

/**
 * The shadow cast on the ground from the bottom of the train, drawn in a box
 * wide enough for its longest lean either way.
 */
const SHADOW_BOX = { pad: 30, h: 20 };

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

/**
 * Where station labels go, left to right; the train dwells under each (see
 * TIMELINE in train-track.ts). Stations fill from the right, so the nearest
 * one always sits next to your station.
 */
const STATION_SLOTS = [12, 90, 164, 248];
const STATION_LABEL_W = 72;

/**
 * Your station: a house at the end of the line, centred on x 355, with a
 * warm glow around it after dark. `pulse` is the centre of the arrival pulse.
 */
const STATION = {
  roof: "M329.5 354 H380.5 L388 366 V368 H322 V366 Z",
  window: (x: number) => `M${x} 380 V374 A3 3 0 0 1 ${x + 6} 374 V380 Z`,
  glow: { cx: 355, cy: 372, rx: 60, ry: 38 },
  pulse: { x: 355, y: 376 },
};
const LAMP = "#FFD27A";
/** The station's name sits at the right edge, clear of the label before it. */
const STATION_LABEL_RIGHT = 12;
const STATION_NAME_W = 64;

type Props = {
  sky: Sky;
  /** Palette blended for `sky.progress`. */
  theme: AppTheme;
  /** The train the countdown is about; null when there is none. */
  train: { tripId: string; etaMs: number } | null;
  /** Up to 4 stations before yours on the line, nearest last. */
  stations: string[];
  /** Your station, named under the house at the end of the line. */
  stationName: string;
  /** Pulse your station when the train is due within a minute. */
  dueSoon: boolean;
  /** Run animations only while the screen is focused and the app is foregrounded. */
  active: boolean;
  accessibilityLabel: string;
  onTrainPress?: () => void;
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
  stations,
  stationName,
  dueSoon,
  active,
  accessibilityLabel,
  onTrainPress,
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
  const shadow = trainShadow(sky.progress, sun?.x ?? moon?.x ?? null);
  const shadowPoints = [
    [SHADOW_BOX.pad, 0],
    [SHADOW_BOX.pad + TRAIN_W, 0],
    [SHADOW_BOX.pad + TRAIN_W + shadow.shift, shadow.length],
    [SHADOW_BOX.pad + shadow.shift, shadow.length],
  ].join(" ");

  // --- Train: position computed every frame on the UI thread. ---
  const tripId = useSharedValue<string | null>(train?.tripId ?? null);
  const etaMs = useSharedValue(train?.etaMs ?? Number.NaN);
  const reduce = useSharedValue(reduceMotion);
  const motion = useSharedValue<TrainMotion>(INITIAL_MOTION);
  const ride = useSharedValue<TrainRide>(INITIAL_RIDE);

  useEffect(() => {
    tripId.set(train?.tripId ?? null);
    etaMs.set(train?.etaMs ?? Number.NaN);
  }, [train?.tripId, train?.etaMs, tripId, etaMs]);
  useEffect(() => reduce.set(reduceMotion), [reduceMotion, reduce]);

  const frame = useFrameCallback((info) => {
    "worklet";
    const prev = motion.value;
    // Null on the first frame after the scene is (re)activated.
    const resumed = info.timeSincePreviousFrame == null;
    const next = stepTrainMotion(
      prev,
      tripId.value,
      etaMs.value,
      Date.now(),
      reduce.value,
      resumed,
    );
    motion.value = next;

    // Settle onto the suspension on stopping. A frame after a pause or
    // a new trip is a jump, not a drive.
    const dt = info.timeSincePreviousFrame ?? 0;
    const drove = dt > 0 && dt < 100 && next.tripId === prev.tripId;
    ride.value = stepTrainRide(
      ride.value,
      drove ? next.x - prev.x : null,
      dt,
      reduce.value,
    );
  }, false);

  useEffect(() => {
    frame.setActive(active);
  }, [active, frame]);

  const trainStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: motion.value.x }, { translateY: ride.value.sag }],
  }));

  // --- Station pulse when the train is due. ---
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
          <Defs>
            {moon && (
              <ClipPath id="moon">
                <Circle cx={moon.x} cy={moon.y} r={moon.r} />
              </ClipPath>
            )}
            <RadialGradient id="glow">
              <Stop offset="0" stopColor={LAMP} stopOpacity={0.2} />
              <Stop offset="0.45" stopColor={LAMP} stopOpacity={0.155} />
              <Stop offset="0.75" stopColor={LAMP} stopOpacity={0.05} />
              <Stop offset="1" stopColor={LAMP} stopOpacity={0} />
            </RadialGradient>
          </Defs>
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
          <Ellipse {...STATION.glow} fill="url(#glow)" opacity={sky.lights} />
          <G fill={t.station}>
            <Rect x={366} y={346} width={5} height={9} />
            <Path d={STATION.roof} />
            <Rect x={323} y={368} width={2} height={20} />
            <Rect x={385} y={368} width={2} height={20} />
            <Rect x={330} y={368} width={50} height={20} />
          </G>
          <G fill={t.win}>
            <Path d={STATION.window(337)} />
            <Path d={STATION.window(367)} />
            <Rect x={351} y={372} width={8} height={16} rx={1} />
          </G>
          {/* The lamp over the door, lit after dark. */}
          <Rect
            x={353}
            y={368}
            width={4}
            height={3}
            rx={1}
            fill={LAMP}
            opacity={0.75 * sky.lights}
          />
        </Svg>

        <Animated.View
          pointerEvents="none"
          style={[styles.pulse, { borderColor: t.you }, pulseStyle]}
        />

        {/* Sized to the train body: Android only delivers touches inside a
            view's bounds, so an overflowing child can't be tapped. */}
        <Animated.View style={[styles.trainTrack, trainStyle]}>
          <View pointerEvents="none" style={styles.shadow}>
            <Svg width={TRAIN_W + SHADOW_BOX.pad * 2} height={SHADOW_BOX.h}>
              <Defs>
                <LinearGradient id="train-shadow" x1="0" y1="0" x2="0" y2="1">
                  <Stop
                    offset="0"
                    stopColor="#000"
                    stopOpacity={shadow.opacity}
                  />
                  <Stop offset="1" stopColor="#000" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Polygon points={shadowPoints} fill="url(#train-shadow)" />
            </Svg>
          </View>
          <View
            pointerEvents="none"
            style={[styles.beam, { opacity: sky.lights }]}
          >
            <Svg width={BEAM.w} height={BEAM.h}>
              <Defs>
                <LinearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={t.beam} stopOpacity={0.95} />
                  <Stop offset="0.34" stopColor={t.beam} stopOpacity={0.37} />
                  <Stop offset="1" stopColor={t.beam} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Polygon points={BEAM_POINTS} fill="url(#beam)" />
            </Svg>
          </View>
          <Pressable
            onPress={onTrainPress}
            disabled={!onTrainPress}
            hitSlop={12}
          >
            <TrainSprite theme={t} />
          </Pressable>
        </Animated.View>

        {stations.slice(-STATION_SLOTS.length).map((name, i, shown) => (
          <Text
            key={`${i}-${name}`}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[
              styles.station,
              {
                left: STATION_SLOTS[STATION_SLOTS.length - shown.length + i],
                color: t.label,
              },
            ]}
          >
            {name}
          </Text>
        ))}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[styles.station, styles.here, { color: t.label }]}
        >
          {stationName}
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
    left: STATION.pulse.x - 15,
    top: STATION.pulse.y - 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  trainTrack: {
    position: "absolute",
    left: -TRAIN_W,
    top: TRAIN_Y,
    width: TRAIN_W,
    height: TRAIN_H,
  },
  shadow: {
    position: "absolute",
    left: -SHADOW_BOX.pad,
    top: TRAIN_H,
  },
  beam: {
    position: "absolute",
    left: BEAM.x,
    top: BEAM.y,
  },
  station: {
    position: "absolute",
    top: 403,
    maxWidth: STATION_LABEL_W,
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  here: {
    right: STATION_LABEL_RIGHT,
    maxWidth: STATION_NAME_W,
    textAlign: "right",
    fontFamily: FontFamily.sansBold,
  },
});
