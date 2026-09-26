import Svg, { ClipPath, Defs, G, Path, Rect } from "react-native-svg";

import type { AppTheme } from "@/constants/theme";

/**
 * The two-car train drawn on the horizon track: a long rear car and a
 * shorter lead car with a rounded nose and a slanted windscreen. Coordinates
 * are points with (0,0) at the pantograph's top-left; the body starts at
 * y 8, sits on the track at the bottom edge, and the nose is the right edge.
 */
export const TRAIN_W = 139;
export const TRAIN_H = 36;

/** Window band, skirt and coupler: the same in every palette. */
const TRIM = "#2A2E35";
const GLASS = "#1C2026";
const STRIPE = "#0A7BC2";

const REAR = { x: 0, w: 76 };
const LEAD = { x: 79, w: 60 };

/** Rounded 4 top-left, 2 bottom-left, 1 on the right. */
const REAR_BODY =
  "M4 8 H75 A1 1 0 0 1 76 9 V35 A1 1 0 0 1 75 36 H2 A2 2 0 0 1 0 34 V12 A4 4 0 0 1 4 8 Z";
/** Square at the back; the roof curves down into a sloped, rounded nose. */
const LEAD_BODY =
  "M79 8 H118 Q121.5 8 124 10.5 L137.2 23.8 Q139 25.6 139 28.2 V33.5 Q139 36 136.5 36 H79 Z";
/** The windscreen: a dark visor along the slope of the nose. */
const VISOR = "M118 9 H123 L139 25 H134 Z";

/** Windows: x of each; all 10 wide. */
const REAR_WINDOWS = [7, 20, 33, 46, 59];
const LEAD_WINDOWS = [86, 99];

export function TrainSprite({ theme: t }: { theme: AppTheme }) {
  return (
    <Svg width={TRAIN_W} height={TRAIN_H}>
      <Defs>
        <ClipPath id="train-rear">
          <Path d={REAR_BODY} />
        </ClipPath>
        <ClipPath id="train-lead">
          <Path d={LEAD_BODY} />
        </ClipPath>
      </Defs>

      <Rect x={18} y={0} width={18} height={2} fill={t.pantograph} />
      <Path
        d="M21 8 L24.5 2.75 H31 L27.5 8"
        stroke={t.pantograph}
        strokeWidth={1.5}
        fill="none"
      />

      <Rect x={REAR.x + REAR.w} y={21} width={3} height={9} fill={TRIM} />

      <G clipPath="url(#train-rear)">
        <Car theme={t} {...REAR} bandW={68} windows={REAR_WINDOWS} />
      </G>

      <G clipPath="url(#train-lead)">
        <Car theme={t} {...LEAD} bandW={29} windows={LEAD_WINDOWS} />
        <Path d={VISOR} fill={GLASS} />
        <Rect x={133} y={26} width={4} height={3} rx={1} fill={t.headlight} />
      </G>
    </Svg>
  );
}

/** One car's body, window band, AT-blue stripe and skirt; clipped to its outline. */
function Car({
  theme: t,
  x,
  w,
  bandW,
  windows,
}: {
  theme: AppTheme;
  x: number;
  w: number;
  bandW: number;
  windows: number[];
}) {
  return (
    <>
      <Rect x={x} y={8} width={w} height={28} fill={t.train} />
      <Rect x={x + 4} y={14} width={bandW} height={9} rx={2} fill={TRIM} />
      {windows.map((wx) => (
        <Rect
          key={wx}
          x={wx}
          y={16}
          width={10}
          height={5}
          rx={1}
          fill={t.trainWin}
        />
      ))}
      <Rect x={x} y={29} width={w} height={2} fill={STRIPE} />
      <Rect x={x} y={32} width={w} height={4} fill={TRIM} />
    </>
  );
}
