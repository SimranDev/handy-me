import { MINUTE } from "@/features/train-tracker/domain/commute";

const HEADWAY = 15 * MINUTE;

/**
 * Stand-in timetable until real transit data is wired up: the first train
 * reaches Sunnyvale 9 minutes after launch, then one every 15 minutes.
 */
const FIRST_ARRIVAL = Date.now() + 9 * MINUTE;

/** The next train still to arrive at `now`. */
export function nextArrival(now: number) {
  if (now < FIRST_ARRIVAL) return FIRST_ARRIVAL;
  return (
    FIRST_ARRIVAL + (Math.floor((now - FIRST_ARRIVAL) / HEADWAY) + 1) * HEADWAY
  );
}
