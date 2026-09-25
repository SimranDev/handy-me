export const MINUTE = 60_000;
/** Assumed walk from home to the platform. */
export const WALK_MINUTES = 7;

type TrainKind = "gone" | "main" | "late" | "scheduled";
type Train = { at: number; eta: number; kind: TrainKind };

export type DepartureRow = {
  index: number;
  time: string;
  status: string;
  tone: "muted" | "late" | "normal";
  selectable: boolean;
};

export type CommutePlan = {
  minsLabel: string;
  arrivalLabel: string;
  leaveTitle: string;
  leaveSub: string;
  rows: DepartureRow[];
  /** x of the train's nose on the 390pt-wide track. */
  trainFront: number;
};

/** Default selection: the next train to arrive. */
export const MAIN_TRAIN = 1;

export const formatClock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function planCommute(
  now: number,
  arrival: number,
  selected: number,
): CommutePlan {
  const trains: Train[] = [
    { at: arrival - 11 * MINUTE, eta: arrival - 11 * MINUTE, kind: "gone" },
    { at: arrival, eta: arrival, kind: "main" },
    { at: arrival + 15 * MINUTE, eta: arrival + 17 * MINUTE, kind: "late" },
    {
      at: arrival + 30 * MINUTE,
      eta: arrival + 30 * MINUTE,
      kind: "scheduled",
    },
  ];
  const target = trains[selected] ?? trains[MAIN_TRAIN];
  const mins = Math.max(0, Math.ceil((target.eta - now) / MINUTE));
  const leave = mins - WALK_MINUTES;

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
  } else {
    leaveTitle = "Catch the next one.";
    leaveSub = `The ${formatClock(trains[Math.min(selected + 1, trains.length - 1)].at)} is on its way.`;
  }

  const statusOf = (train: Train): Pick<DepartureRow, "status" | "tone"> => {
    switch (train.kind) {
      case "gone":
        return {
          status: `Left ${Math.max(1, Math.round((now - train.at) / MINUTE))} min ago`,
          tone: "muted",
        };
      case "late":
        return { status: "Running 2 min late", tone: "late" };
      case "main":
        return {
          status: `In ${Math.max(0, Math.ceil((train.eta - now) / MINUTE))} min`,
          tone: "normal",
        };
      default:
        return { status: "Scheduled", tone: "muted" };
    }
  };

  const rows = trains
    .map((train, index) => ({ train, index }))
    .filter(({ index }) => index !== selected)
    .map(({ train, index }) => ({
      index,
      time: formatClock(train.at),
      selectable: train.kind !== "gone",
      ...statusOf(train),
    }));

  const mainRemaining = Math.max(0, (arrival - now) / MINUTE);

  return {
    minsLabel:
      mins === 0 ? "Arriving" : mins === 1 ? "1 minute" : `${mins} minutes`,
    arrivalLabel: formatClock(target.at),
    leaveTitle,
    leaveSub,
    rows,
    trainFront: Math.max(-40, 358 - mainRemaining * 16.2),
  };
}
