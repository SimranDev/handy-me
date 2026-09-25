import { atGet, TZ } from "./at.ts";

/** JSON:API envelope used by AT's GTFS v3 endpoints. */
type JsonApi<T> = { data: { type: string; id: string; attributes: T }[] };

export const RAIL = 2;
export const STATION = 1;

export type Stop = {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  location_type: number;
  parent_station?: string;
  platform_code?: string;
  /** Missing on some stops. 2 = rail, 3 = bus, 4 = ferry. */
  vehicle_type?: number;
  stop_lat: number;
  stop_lon: number;
};

export type StopTrip = {
  trip_id: string;
  route_id: string;
  direction_id: number;
  /** GTFS time, may exceed 24:00:00 for trips after midnight. */
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
  trip_headsign: string;
  /** e.g. "Manukau via City Centre"; more readable than trip_headsign. */
  stop_headsign?: string;
  service_date: string;
  trip_start_time?: string;
};

/** A stoptrip with its scheduled departure resolved to an instant. */
export type ScheduledTrip = StopTrip & { scheduledMs: number };

export async function getStops(date: string, sample?: string): Promise<Stop[]> {
  const res = await atGet<JsonApi<Stop>>(`/gtfs/v3/stops?filter[date]=${date}`, sample);
  return res.data.map((d) => d.attributes);
}

/**
 * Note: AT rejects `start_hour=0` (it fails a "required" check), so trips
 * just after midnight must be fetched from the previous service date with
 * start_hour=24.
 */
export async function getStopTrips(
  stopId: string,
  date: string,
  startHour: number,
  hourRange: number,
  sample?: string,
): Promise<ScheduledTrip[]> {
  const res = await atGet<JsonApi<StopTrip>>(
    `/gtfs/v3/stops/${encodeURIComponent(stopId)}/stoptrips` +
      `?filter[date]=${date}&filter[start_hour]=${startHour}&filter[hour_range]=${hourRange}`,
    sample,
  );
  return res.data.map((d) => ({
    ...d.attributes,
    scheduledMs: gtfsTimeToMs(d.attributes.service_date, d.attributes.departure_time),
  }));
}

/** Offset of Auckland from UTC at `ms`, in ms (e.g. +13h in NZDT). */
function aucklandOffsetMs(ms: number): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(ms)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3])) * 60_000;
}

/**
 * GTFS times are measured from "noon minus 12h" on the service date, local
 * time, which keeps them correct across DST changes and past midnight.
 */
export function gtfsTimeToMs(serviceDate: string, time: string): number {
  const [y, mo, d] = serviceDate.split("-").map(Number);
  const [h, mi, s] = time.split(":").map(Number);
  const noonUtc = Date.UTC(y, mo - 1, d, 12);
  const noonLocal = noonUtc - aucklandOffsetMs(noonUtc);
  return noonLocal - 12 * 3_600_000 + ((h * 60 + mi) * 60 + s) * 1000;
}

/** Auckland wall-clock parts for an instant. */
export function aucklandParts(ms: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    clock: `${get("hour")}:${get("minute")}`,
    clockSeconds: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

export function previousDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}
