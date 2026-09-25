/**
 * How the drawn train rides the track: it glides level while moving and
 * sinks softly onto its suspension when it pulls up at a station. Only the
 * vertical offset of the body; where the train is comes from train-track.ts.
 * Everything here is a worklet, run every frame.
 */

/** The suspension: a well-damped spring, so it settles without bouncing. */
const SPRING_W = 2 * Math.PI * 1.2; // rad/s
const SPRING_DAMPING = 0.7;
/** Downward kick (pt/s) on stopping; peaks at about 0.5pt. */
const STOP_KICK = 8;
/** Only a real run ends in a settle, not a nudge (pt). */
const MIN_RUN = 5;

export type TrainRide = {
  /** Distance covered since the train last stood still (pt). */
  run: number;
  /** Suspension offset (pt, down is positive) and its velocity (pt/s). */
  sag: number;
  sagV: number;
};

export const INITIAL_RIDE: TrainRide = { run: 0, sag: 0, sagV: 0 };

/**
 * Advance the ride by one frame in which the train moved `dx` pt over
 * `dtMs`. Pass `dx` null when the train jumped rather than drove (a new
 * trip, or the first frame after the scene was paused): that starts a fresh
 * run with no settle. With reduced motion the body stays level.
 */
export function stepTrainRide(
  prev: TrainRide,
  dx: number | null,
  dtMs: number,
  reduceMotion: boolean,
): TrainRide {
  "worklet";
  if (reduceMotion) return INITIAL_RIDE;
  if (dx == null || !(dtMs > 0)) return { ...prev, run: 0 };

  let run = prev.run;
  let sagV = prev.sagV;
  if (dx > 0) {
    run += dx;
  } else {
    if (run >= MIN_RUN) sagV += STOP_KICK;
    run = 0;
  }

  const dt = Math.min(dtMs, 50) / 1000;
  sagV +=
    (-SPRING_W * SPRING_W * prev.sag - 2 * SPRING_DAMPING * SPRING_W * sagV) *
    dt;
  let sag = prev.sag + sagV * dt;
  if (Math.abs(sag) < 0.005 && Math.abs(sagV) < 0.05) {
    sag = 0;
    sagV = 0;
  }

  return { run, sag, sagV };
}
