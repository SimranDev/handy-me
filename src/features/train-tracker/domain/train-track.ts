/**
 * Where the train is drawn on the 390pt-wide horizon track, as a pure
 * function of time. Everything here is a worklet so the scene can run it on
 * the UI thread every frame.
 */

/**
 * The run into our stop: [minutes before our departure, x of the train's
 * nose]. Pairs with equal x are dwells at the four station slots drawn in
 * the scene (STATION_SLOTS in horizon-scene.tsx). Timings follow a typical
 * four-station run in to a stop (~11 min, e.g. Swanson → Sunnyvale).
 */
const TIMELINE: readonly (readonly [number, number])[] = [
  [14, -70], // off-stage left
  [11, 70], // 4th station back
  [10.75, 70],
  [8.5, 135], // 3rd
  [8.25, 135],
  [6, 220], // 2nd
  [5.75, 220],
  [3, 300], // the station before yours
  [2.75, 300],
  [0, 358], // You (departs at the ETA)
  [-0.5, 358],
  [-1.5, 520], // off-stage right
];

export const OFFSTAGE_LEFT_X = TIMELINE[0][1];

/** How long a forward correction glides for. */
export const GLIDE_MS = 1500;

export function easeInOutCubic(u: number): number {
  "worklet";
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
}

function easeOutCubic(u: number): number {
  "worklet";
  return 1 - (1 - u) ** 3;
}

/**
 * x of the train's nose when it departs our stop in `remainingMs`. Between
 * stations the position follows an ease-in-out curve, so the train slows
 * into each station and speeds up leaving it. Never decreases as time passes.
 */
export function trainFrontX(remainingMs: number): number {
  "worklet";
  if (!Number.isFinite(remainingMs)) return OFFSTAGE_LEFT_X;
  const minutes = remainingMs / 60_000;
  if (minutes >= TIMELINE[0][0]) return TIMELINE[0][1];
  for (let i = 1; i < TIMELINE.length; i++) {
    const [m1, x1] = TIMELINE[i];
    if (minutes >= m1) {
      const [m0, x0] = TIMELINE[i - 1];
      return x0 + (x1 - x0) * easeInOutCubic((m0 - minutes) / (m0 - m1));
    }
  }
  return TIMELINE[TIMELINE.length - 1][1];
}

export type TrainMotion = {
  /** Drawn x of the nose. */
  x: number;
  tripId: string | null;
  etaMs: number;
  /** Where a forward glide started from, and when (-1 = not gliding). */
  glideFromX: number;
  glideStartMs: number;
};

export const INITIAL_MOTION: TrainMotion = {
  x: OFFSTAGE_LEFT_X,
  tripId: null,
  etaMs: Number.NaN,
  glideFromX: OFFSTAGE_LEFT_X,
  glideStartMs: -1,
};

/**
 * Advance the drawn train to `nowMs`.
 * - A different train (trip) jumps straight to its position.
 * - A new ETA that puts the train further ahead glides there over GLIDE_MS
 *   (or jumps, with reduced motion).
 * - The train never moves backwards: if a new ETA puts it behind where it
 *   is drawn, it holds until the timeline catches up.
 */
export function stepTrainMotion(
  prev: TrainMotion,
  tripId: string | null,
  etaMs: number,
  nowMs: number,
  reduceMotion: boolean,
): TrainMotion {
  "worklet";
  const ideal = trainFrontX(etaMs - nowMs);
  if (tripId !== prev.tripId) {
    return { x: ideal, tripId, etaMs, glideFromX: ideal, glideStartMs: -1 };
  }

  let { glideFromX, glideStartMs } = prev;
  const corrected = etaMs !== prev.etaMs && !Number.isNaN(prev.etaMs);
  if (corrected && ideal > prev.x) {
    if (reduceMotion) {
      glideStartMs = -1;
    } else {
      glideFromX = prev.x;
      glideStartMs = nowMs;
    }
  }

  let target = ideal;
  if (glideStartMs >= 0) {
    const u = (nowMs - glideStartMs) / GLIDE_MS;
    if (u >= 1) glideStartMs = -1;
    else target = glideFromX + (ideal - glideFromX) * easeOutCubic(u);
  }

  return {
    x: Math.max(prev.x, target),
    tripId,
    etaMs,
    glideFromX,
    glideStartMs,
  };
}
