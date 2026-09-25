import type {
  Arrival,
  Arrivals,
} from "@/features/train-tracker/domain/arrivals";
import { WALK_MINUTES } from "@/features/train-tracker/domain/config";
import { formatClock, MINUTE } from "@/domain/time";

export type DepartureRow = {
  tripId: string;
  time: string;
  status: string;
  tone: "muted" | "late" | "normal";
  selectable: boolean;
};

export type CommutePlan = {
  /** Trip the countdown is about: the picked train, else the next one. */
  targetTripId: string | null;
  minsLabel: string;
  /** Scheduled time of the target train, e.g. "20:44"; null when there is none. */
  arrivalLabel: string | null;
  leaveTitle: string;
  leaveSub: string;
  rows: DepartureRow[];
  /** Estimated departure of the target train; drives the train in the scene. */
  targetEtaMs: number | null;
  /** Minutes until you need to leave for the target train (0 = now, negative = too late). */
  leaveMinutes: number | null;
  /** Spoken summary of the scene, e.g. "Train 9 minutes away, arrives 10:42". */
  sceneLabel: string;
};

const MAX_ROWS = 3;

/**
 * What to show on the commute screen at `nowMs`. `pickedTripId` is the train
 * the user tapped; if it has gone (or was cancelled) the next train is used.
 */
export function planCommute(
  nowMs: number,
  arrivals: Arrivals,
  pickedTripId?: string | null,
): CommutePlan {
  const { justDeparted, next, afterNext } = arrivals;
  const catchable = [next, ...afterNext].filter(
    (a): a is Arrival => a != null && a.status.kind !== "cancelled",
  );
  const target = catchable.find((a) => a.tripId === pickedTripId) ?? next;
  const minsUntil = (a: Arrival) =>
    Math.max(0, Math.ceil((a.etaMs - nowMs) / MINUTE));

  const rows = [justDeparted, next, ...afterNext]
    .filter((a): a is Arrival => a != null && a.tripId !== target?.tripId)
    .slice(0, MAX_ROWS)
    .map((a) => rowFor(a, a === justDeparted, nowMs, minsUntil(a)));

  if (!target) {
    return {
      targetTripId: null,
      minsLabel: "No trains",
      arrivalLabel: null,
      leaveTitle: "Nothing to catch.",
      leaveSub: "No trains are due in the next two hours.",
      rows,
      targetEtaMs: null,
      leaveMinutes: null,
      sceneLabel: "No trains in the next two hours",
    };
  }

  const mins = minsUntil(target);
  const leave = mins - WALK_MINUTES;
  const later = catchable[catchable.indexOf(target) + 1];

  let leaveTitle: string;
  let leaveSub: string;
  if (leave > 1) {
    leaveTitle = `Leave in ${leave} minutes.`;
    leaveSub = "A brisk walk gets you to the platform with a minute to spare.";
  } else if (leave === 1) {
    leaveTitle = "Leave in 1 minute.";
    leaveSub = "Shoes on. You will reach the platform just as it pulls in.";
  } else if (leave >= -1) {
    leaveTitle = "Leave now.";
    leaveSub = "Walk quickly and you will just make it.";
  } else if (later) {
    leaveTitle = "Catch the next one.";
    leaveSub = `The ${formatClock(later.scheduledMs)} is on its way.`;
  } else {
    leaveTitle = "Too late for this one.";
    leaveSub = "There is no later train in the next two hours.";
  }

  return {
    targetTripId: target.tripId,
    minsLabel:
      mins === 0 ? "Arriving" : mins === 1 ? "1 minute" : `${mins} minutes`,
    arrivalLabel: formatClock(target.scheduledMs),
    leaveTitle,
    leaveSub,
    rows,
    targetEtaMs: target.etaMs,
    leaveMinutes: leave,
    sceneLabel:
      mins === 0
        ? `Train arriving now, departs ${formatClock(target.etaMs)}`
        : `Train ${mins} minute${mins === 1 ? "" : "s"} away, arrives ${formatClock(target.etaMs)}`,
  };
}

function rowFor(
  a: Arrival,
  departed: boolean,
  nowMs: number,
  mins: number,
): DepartureRow {
  const base = { tripId: a.tripId, time: formatClock(a.scheduledMs) };
  if (departed) {
    const ago = Math.max(1, Math.round((nowMs - a.etaMs) / MINUTE));
    return {
      ...base,
      status: `Left ${ago} min ago`,
      tone: "muted",
      selectable: false,
    };
  }
  switch (a.status.kind) {
    case "cancelled":
      return { ...base, status: "Cancelled", tone: "late", selectable: false };
    case "late":
      return {
        ...base,
        status: `Running ${a.status.minutes} min late`,
        tone: "late",
        selectable: true,
      };
    default:
      return a.source === "live"
        ? {
            ...base,
            status: `In ${mins} min`,
            tone: "normal",
            selectable: true,
          }
        : { ...base, status: "Scheduled", tone: "muted", selectable: true };
  }
}
