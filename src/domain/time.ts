export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const TZ = "Pacific/Auckland";

// Only timeZone + formatToParts are used (no "longOffset"), which Hermes supports.
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export type AucklandParts = {
  /** YYYY-MM-DD, as AT's `filter[date]` expects. */
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Auckland wall-clock parts for an instant. */
export function aucklandParts(ms: number): AucklandParts {
  const parts = formatter.formatToParts(ms);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    year,
    month,
    day,
    // Some engines render midnight as "24" even with h23.
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of Auckland from UTC at `ms` (e.g. +13h in NZDT). */
function aucklandOffsetMs(ms: number): number {
  const p = aucklandParts(ms);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/**
 * GTFS times count from "noon minus 12h" on the service date, local time, so
 * they stay correct across DST changes and can exceed 24:00:00 for trips that
 * run past midnight.
 */
export function gtfsTimeToMs(serviceDate: string, time: string): number {
  const [y, mo, d] = serviceDate.split("-").map(Number);
  const [h, mi, s] = time.split(":").map(Number);
  const noonUtc = Date.UTC(y, mo - 1, d, 12);
  const noonLocal = noonUtc - aucklandOffsetMs(noonUtc);
  return noonLocal - 12 * HOUR + ((h * 60 + mi) * 60 + (s || 0)) * 1000;
}

/** "HH:MM" in Auckland time. */
export function formatClock(ms: number): string {
  const p = aucklandParts(ms);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function previousDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

export function nextDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");
