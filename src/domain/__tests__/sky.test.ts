import { dayTimes, greetingFor, skyAt } from "@/domain/sky";
import { formatClock, HOUR, MINUTE } from "@/domain/time";

const at = (iso: string) => Date.parse(iso);

describe("dayTimes (Auckland)", () => {
  it.each([
    // date, dawn, sunrise, sunset, dusk (local clock)
    ["2026-12-21", "05:27", "05:58", "20:39", "21:10"], // summer solstice, NZDT
    ["2026-06-21", "07:04", "07:33", "17:11", "17:40"], // winter solstice, NZST
  ])("%s matches the almanac", (date, dawn, sunrise, sunset, dusk) => {
    const d = dayTimes(date);
    expect([d.dawn, d.sunrise, d.sunset, d.dusk].map(formatClock)).toEqual([
      dawn,
      sunrise,
      sunset,
      dusk,
    ]);
  });

  it("handles the day clocks go forward (27 Sep 2026)", () => {
    const before = dayTimes("2026-09-26");
    const after = dayTimes("2026-09-27");
    expect(formatClock(before.sunrise)).toBe("06:05");
    expect(formatClock(after.sunrise)).toBe("07:03"); // an hour later on the clock…
    const gap = after.sunrise - before.sunrise;
    expect(gap).toBeGreaterThan(23.9 * HOUR); // …but ~2 min earlier in real time
    expect(gap).toBeLessThan(24 * HOUR);
  });

  it("handles the day clocks go back (4 Apr 2027)", () => {
    expect(formatClock(dayTimes("2027-04-03").sunset)).toBe("19:12");
    expect(formatClock(dayTimes("2027-04-04").sunset)).toBe("18:11");
    expect(formatClock(dayTimes("2027-04-04").sunrise)).toBe("06:36");
  });
});

describe("skyAt", () => {
  const summer = dayTimes("2026-12-21");
  const winter = dayTimes("2026-06-21");

  it("crosses 1 (dawn) exactly at sunrise", () => {
    const before = skyAt(summer.sunrise - MINUTE);
    const after = skyAt(summer.sunrise + MINUTE);
    expect(before.progress).toBeGreaterThan(0.9);
    expect(before.progress).toBeLessThan(1);
    expect(after.progress).toBeGreaterThan(1);
    expect(after.progress).toBeLessThan(1.1);
    expect(before.phase).toBe("dawn");
    expect(before.sun!).toBeLessThan(0); // still below the horizon
    expect(after.sun!).toBeGreaterThan(0);
  });

  it("crosses 3 (dusk) exactly at sunset", () => {
    const before = skyAt(winter.sunset - MINUTE);
    const after = skyAt(winter.sunset + MINUTE);
    expect(before.progress).toBeLessThan(3);
    expect(after.progress).toBeGreaterThan(3);
    expect([before.phase, after.phase]).toEqual(["dusk", "dusk"]);
    expect(before.sun!).toBeLessThan(1);
    expect(after.sun!).toBeGreaterThan(1); // sinking behind the hills
  });

  it("is full midday at solar noon", () => {
    const noon = skyAt(summer.solarNoon);
    expect(noon).toMatchObject({
      progress: 2,
      phase: "midday",
      clouds: 1,
      night: 0,
      lights: 0,
      moon: null,
    });
    expect(noon.sun!).toBeGreaterThan(0.4);
    expect(noon.sun!).toBeLessThan(0.6);
  });

  it("is night between civil dusk and dawn, with the moon on its arc", () => {
    const early = skyAt(at("2026-06-21T02:00:00+12:00"));
    expect(early).toMatchObject({
      progress: 0,
      phase: "night",
      night: 1,
      lights: 1,
      clouds: 0,
      sun: null,
    });
    expect(early.moon!).toBeGreaterThan(0.5);
    expect(early.moon!).toBeLessThan(1);

    const late = skyAt(at("2026-12-21T22:00:00+13:00"));
    expect(late).toMatchObject({ progress: 4, phase: "night", night: 1 });
    expect(late.moon!).toBeGreaterThan(0);
    expect(late.moon!).toBeLessThan(0.2);
  });

  it("moves the moon from 0 at dusk to 1 at the next dawn", () => {
    expect(skyAt(winter.dusk).moon).toBeCloseTo(0);
    expect(skyAt(dayTimes("2026-06-22").dawn - 1).moon).toBeCloseTo(1);
  });

  it("follows real daylight across the clocks-forward day", () => {
    // 06:30 NZDT is before dawn (06:37); the old fixed hours called it dawn.
    expect(skyAt(at("2026-09-27T06:30:00+13:00")).phase).toBe("night");
    const evening = skyAt(at("2026-09-27T19:00:00+13:00"));
    expect(evening.phase).toBe("dusk");
    expect(evening.sun!).toBeLessThan(1); // sunset is 19:21
  });

  it("changes smoothly through a whole day, never jumping", () => {
    const start = at("2026-09-27T00:00:00+12:00");
    const end = at("2026-09-28T00:00:00+13:00");
    let prev = skyAt(start);
    for (let t = start + MINUTE; t < end; t += MINUTE) {
      const next = skyAt(t);
      const step = next.progress - prev.progress;
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThan(0.05);
      expect(Math.abs(next.night - prev.night)).toBeLessThan(0.05);
      expect(Math.abs(next.lights - prev.lights)).toBeLessThan(0.1);
      prev = next;
    }
  });
});

it("greets by the clock once the sky reaches midday", () => {
  expect(greetingFor("midday", at("2026-12-21T10:00:00+13:00"))).toBe(
    "Good morning",
  );
  expect(greetingFor("midday", at("2026-12-21T14:00:00+13:00"))).toBe(
    "Good afternoon",
  );
  expect(greetingFor("night", at("2026-12-21T23:00:00+13:00"))).toBe(
    "Late one",
  );
});
