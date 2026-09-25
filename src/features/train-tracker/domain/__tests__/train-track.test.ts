import { MINUTE } from "@/domain/time";
import {
  GLIDE_MS,
  INITIAL_MOTION,
  OFFSTAGE_LEFT_X,
  stepTrainMotion,
  type TrainMotion,
  trainFrontX,
} from "@/features/train-tracker/domain/train-track";

const SECOND = 1000;

describe("trainFrontX", () => {
  it("reaches You at the ETA and waits there briefly", () => {
    expect(trainFrontX(0)).toBe(358);
    expect(trainFrontX(-20 * SECOND)).toBe(358);
  });

  it("is off stage well before, and after it has left", () => {
    expect(trainFrontX(20 * MINUTE)).toBe(OFFSTAGE_LEFT_X);
    expect(trainFrontX(Number.NaN)).toBe(OFFSTAGE_LEFT_X);
    expect(trainFrontX(-2 * MINUTE)).toBe(520);
  });

  it("dwells at stations", () => {
    expect(trainFrontX(3 * MINUTE)).toBe(300); // Henderson
    expect(trainFrontX(2.8 * MINUTE)).toBe(300);
  });

  it("only ever moves forward as time passes", () => {
    let prev = trainFrontX(16 * MINUTE);
    for (let ms = 16 * MINUTE; ms > -2 * MINUTE; ms -= SECOND) {
      const x = trainFrontX(ms);
      expect(x).toBeGreaterThanOrEqual(prev);
      prev = x;
    }
  });

  it("slows arriving at a station and is fastest between stations", () => {
    const speed = (ms: number) => trainFrontX(ms - SECOND) - trainFrontX(ms);
    const intoHenderson = speed(3 * MINUTE + 5 * SECOND);
    const midSegment = speed(4.375 * MINUTE); // between Sturges Rd and Henderson
    const leavingHenderson = speed(2.75 * MINUTE - 5 * SECOND);
    expect(intoHenderson).toBeLessThan(midSegment / 10);
    expect(leavingHenderson).toBeLessThan(midSegment / 10);
  });
});

describe("stepTrainMotion", () => {
  const t0 = Date.parse("2026-09-26T08:00:00+12:00");
  const eta = t0 + 4.4 * MINUTE; // mid-way from Sturges Rd to Henderson
  const start = (reduce = false): TrainMotion =>
    stepTrainMotion(INITIAL_MOTION, "trip-a", eta, t0, reduce);

  it("follows the timeline", () => {
    const m = start();
    expect(m.x).toBe(trainFrontX(eta - t0));
    const later = stepTrainMotion(m, "trip-a", eta, t0 + 10 * SECOND, false);
    expect(later.x).toBe(trainFrontX(eta - t0 - 10 * SECOND));
  });

  it("glides forward over ~1.5s when a new ETA puts the train ahead", () => {
    const m = start();
    const sooner = eta - MINUTE;
    const first = stepTrainMotion(m, "trip-a", sooner, t0, false);
    expect(first.x).toBe(m.x); // starts where it was drawn

    const mid = stepTrainMotion(
      first,
      "trip-a",
      sooner,
      t0 + GLIDE_MS / 2,
      false,
    );
    const ideal = (t: number) => trainFrontX(sooner - t);
    expect(mid.x).toBeGreaterThan(m.x);
    expect(mid.x).toBeLessThan(ideal(t0 + GLIDE_MS / 2));

    const done = stepTrainMotion(mid, "trip-a", sooner, t0 + GLIDE_MS, false);
    expect(done.x).toBe(ideal(t0 + GLIDE_MS));
  });

  it("jumps instead of gliding with reduced motion", () => {
    const m = start(true);
    const sooner = eta - MINUTE;
    const next = stepTrainMotion(m, "trip-a", sooner, t0, true);
    expect(next.x).toBe(trainFrontX(sooner - t0));
  });

  it("never moves backwards: holds until the timeline catches up", () => {
    const m = start();
    const later = eta + MINUTE; // new ETA would put the train behind
    const held = stepTrainMotion(m, "trip-a", later, t0, false);
    expect(held.x).toBe(m.x);

    const stillHeld = stepTrainMotion(
      held,
      "trip-a",
      later,
      t0 + 30 * SECOND,
      false,
    );
    expect(stillHeld.x).toBe(m.x);

    const caughtUp = t0 + 70 * SECOND;
    const moving = stepTrainMotion(stillHeld, "trip-a", later, caughtUp, false);
    expect(moving.x).toBe(trainFrontX(later - caughtUp));
    expect(moving.x).toBeGreaterThan(m.x);
  });

  it("jumps to a different train, even backwards", () => {
    const gone = stepTrainMotion(
      start(),
      "trip-a",
      eta,
      eta + 3 * MINUTE,
      false,
    );
    expect(gone.x).toBe(520);
    const next = stepTrainMotion(
      gone,
      "trip-b",
      eta + 15 * MINUTE,
      eta + 3 * MINUTE,
      false,
    );
    expect(next.x).toBe(trainFrontX(12 * MINUTE));
  });
});
