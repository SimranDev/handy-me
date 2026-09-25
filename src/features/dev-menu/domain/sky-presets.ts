import { dayTimes } from "@/domain/sky";
import { gtfsTimeToMs } from "@/domain/time";

export type SkyPreset = { label: string; at: number };

/** Moments worth checking the palette at, in order through an Auckland date (YYYY-MM-DD). */
export function skyPresets(date: string): SkyPreset[] {
  const day = dayTimes(date);
  return [
    { label: "Midnight", at: gtfsTimeToMs(date, "00:00:00") },
    { label: "Dawn", at: day.dawn },
    { label: "Sunrise", at: day.sunrise },
    { label: "Noon", at: day.solarNoon },
    { label: "Sunset", at: day.sunset },
    { label: "Dusk", at: day.dusk },
  ];
}
