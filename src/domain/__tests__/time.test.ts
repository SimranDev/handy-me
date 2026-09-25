import {
  aucklandParts,
  formatAgo,
  formatClock,
  gtfsTimeToMs,
  previousDate,
} from "@/domain/time";

describe("gtfsTimeToMs", () => {
  it("resolves a time on the service date in Auckland time", () => {
    expect(gtfsTimeToMs("2026-09-25", "23:34:00")).toBe(
      Date.parse("2026-09-25T23:34:00+12:00"),
    );
  });

  it("rolls times past 24:00 into the next calendar day", () => {
    expect(gtfsTimeToMs("2026-09-25", "24:04:00")).toBe(
      Date.parse("2026-09-26T00:04:00+12:00"),
    );
    expect(gtfsTimeToMs("2026-09-25", "25:30:15")).toBe(
      Date.parse("2026-09-26T01:30:15+12:00"),
    );
  });

  it("uses the daylight-saving offset in force at noon on the service day", () => {
    // NZDT starts 2026-09-27 at 02:00; ends 2027-04-04 at 03:00.
    expect(gtfsTimeToMs("2026-09-27", "08:00:00")).toBe(
      Date.parse("2026-09-27T08:00:00+13:00"),
    );
    expect(gtfsTimeToMs("2027-04-04", "08:00:00")).toBe(
      Date.parse("2027-04-04T08:00:00+12:00"),
    );
  });
});

describe("aucklandParts", () => {
  it("gives Auckland wall-clock parts for an instant", () => {
    const parts = aucklandParts(Date.parse("2026-09-25T11:53:43Z"));
    expect(parts).toMatchObject({
      date: "2026-09-25",
      hour: 23,
      minute: 53,
      second: 43,
    });
  });

  it("reports midnight as hour 0 on the new date", () => {
    expect(aucklandParts(Date.parse("2026-09-25T12:00:00Z"))).toMatchObject({
      date: "2026-09-26",
      hour: 0,
    });
  });
});

it("formatClock renders HH:MM in Auckland time", () => {
  expect(formatClock(Date.parse("2026-09-25T12:04:09Z"))).toBe("00:04");
});

it("previousDate crosses month and year boundaries", () => {
  expect(previousDate("2026-10-01")).toBe("2026-09-30");
  expect(previousDate("2027-01-01")).toBe("2026-12-31");
});

describe("formatAgo", () => {
  it.each([
    [0, "just now"],
    [59_000, "just now"],
    [60_000, "1 min ago"],
    [59 * 60_000, "59 min ago"],
    [2.5 * 3_600_000, "2 h ago"],
  ])("%p ms → %p", (ms, text) => {
    expect(formatAgo(ms)).toBe(text);
  });
});
