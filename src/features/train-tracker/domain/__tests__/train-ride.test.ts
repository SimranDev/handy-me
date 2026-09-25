import {
  INITIAL_RIDE,
  stepTrainRide,
  type TrainRide,
} from "@/features/train-tracker/domain/train-ride";

const FRAME = 1000 / 60;

/** Drive at `speed` pt/ms for `ms`, returning every frame's ride. */
function drive(from: TrainRide, speed: number, ms: number, reduce = false) {
  const frames: TrainRide[] = [];
  let ride = from;
  for (let t = 0; t < ms; t += FRAME) {
    ride = stepTrainRide(ride, speed * FRAME, FRAME, reduce);
    frames.push(ride);
  }
  return frames;
}

const last = <T>(xs: T[]) => xs[xs.length - 1];
const sags = (frames: TrainRide[]) => frames.map((r) => r.sag);

describe("stepTrainRide", () => {
  it("stays level while standing still and while moving", () => {
    for (const ride of drive(INITIAL_RIDE, 0, 3000)) expect(ride.sag).toBe(0);
    for (const ride of drive(INITIAL_RIDE, 0.0007, 10_000)) {
      expect(ride.sag).toBe(0);
    }
  });

  it("sinks softly when it stops after a run, without bouncing", () => {
    const moving = last(drive(INITIAL_RIDE, 0.0007, 10_000));
    const stopped = drive(moving, 0, 3000);
    const peak = Math.max(...sags(stopped));
    expect(peak).toBeGreaterThan(0.3);
    expect(peak).toBeLessThan(0.7);
    expect(Math.min(...sags(stopped))).toBeGreaterThan(-0.05);
    expect(last(stopped).sag).toBe(0);
  });

  it("does not settle after a short nudge", () => {
    const nudged = last(drive(INITIAL_RIDE, 0.0007, 1000));
    for (const ride of drive(nudged, 0, 3000)) expect(ride.sag).toBe(0);
  });

  it("does not settle after a jump", () => {
    const moving = last(drive(INITIAL_RIDE, 0.0007, 10_000));
    const jumped = stepTrainRide(moving, null, FRAME, false);
    for (const ride of drive(jumped, 0, 3000)) expect(ride.sag).toBe(0);
  });

  it("keeps the body level with reduced motion", () => {
    const moving = drive(INITIAL_RIDE, 0.0007, 10_000, true);
    for (const ride of [...moving, ...drive(last(moving), 0, 3000, true)]) {
      expect(ride.sag).toBe(0);
    }
  });
});
