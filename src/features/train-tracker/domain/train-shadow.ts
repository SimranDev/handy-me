/**
 * The shadow the train casts on the ground below the track: long and soft
 * with the sun low at dawn and dusk, short and crisp at midday, faint by
 * moonlight. It falls away from the light, so it swings from one side to the
 * other as the sun crosses the sky.
 */
export type TrainShadow = {
  /** How far it reaches down from the track (pt). */
  length: number;
  /** Sideways shift of its far edge (pt); negative is to the left. */
  shift: number;
  /** Darkness where it meets the train, fading to nothing at its far edge. */
  opacity: number;
};

/**
 * [length, lean in degrees, opacity] at each palette of `Sky.progress`:
 * night, dawn, midday, dusk, night.
 */
const STOPS: readonly (readonly [number, number, number])[] = [
  [8, 30, 0.18],
  [16, 58, 0.26],
  [5, 12, 0.3],
  [16, 52, 0.28],
  [8, 30, 0.18],
];

/** Scene centre (pt): a light right of here casts the shadow left. */
const CENTRE_X = 195;
/** How far from the centre the light must be to lean the shadow fully. */
const FULL_LEAN_X = 100;

/**
 * The shadow for a sky `progress` (0–4) with the sun or moon at `lightX`
 * across the 390pt scene (null when neither is up: lean as if from the east).
 */
export function trainShadow(
  progress: number,
  lightX: number | null,
): TrainShadow {
  const p = Math.min(4, Math.max(0, progress));
  const i = Math.min(3, Math.floor(p));
  const u = p - i;
  const [length, lean, opacity] = STOPS[i].map(
    (v, k) => v + (STOPS[i + 1][k] - v) * u,
  );
  const side =
    lightX == null
      ? 1
      : Math.min(1, Math.max(-1, (lightX - CENTRE_X) / FULL_LEAN_X));
  const shift = -Math.tan((lean * Math.PI) / 180) * length * side;
  return { length, shift: shift === 0 ? 0 : shift, opacity };
}
