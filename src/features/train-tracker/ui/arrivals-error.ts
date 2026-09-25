import { AtApiError } from "@/features/train-tracker/api/at-client";
import { StopNotFoundError } from "@/features/train-tracker/domain/stop-resolver";
import { formatAgo } from "@/domain/time";

export type ArrivalsFailure = {
  title: string;
  detail: string;
  /** The fix is in Settings (key or station), so offer a link there. */
  needsSettings: boolean;
  /** Shown above trains kept from before the failure. */
  staleNotice: (ageMs: number) => string;
};

/**
 * User-facing copy for a failed AT request (arrivals by default). Never
 * includes error details.
 */
export function describeArrivalsError(
  error: unknown,
  fallbackTitle = "Couldn't load trains.",
): ArrivalsFailure {
  const updated = (ageMs: number) => `Last updated ${formatAgo(ageMs)}.`;

  if (error instanceof StopNotFoundError) {
    return {
      title: "Your platform isn't in today's timetable.",
      detail:
        "Auckland Transport may have changed it. Choose your station again in Settings.",
      needsSettings: true,
      staleNotice: (age) => `Your platform wasn't found. ${updated(age)}`,
    };
  }
  if (error instanceof AtApiError) {
    switch (error.kind) {
      case "missing-key":
        return {
          title: "Add your AT API key.",
          detail:
            "Live trains need a free Auckland Transport API key, saved securely on this phone.",
          needsSettings: true,
          staleNotice: (age) => `No API key saved. ${updated(age)}`,
        };
      case "unauthorized":
        return {
          title: "Your AT API key was rejected.",
          detail:
            "It may have expired or been regenerated. Replace it in Settings.",
          needsSettings: true,
          staleNotice: (age) => `Your API key was rejected. ${updated(age)}`,
        };
      case "rate-limited":
        return {
          title: "Auckland Transport is busy.",
          detail: "Too many requests right now. Trying again shortly.",
          needsSettings: false,
          staleNotice: (age) =>
            `Auckland Transport is busy, trying again shortly. ${updated(age)}`,
        };
      case "network":
        return {
          title: "You're offline.",
          detail: "Can't reach Auckland Transport. Trying again shortly.",
          needsSettings: false,
          staleNotice: (age) => `Offline. ${updated(age)}`,
        };
    }
  }
  return {
    title: fallbackTitle,
    detail: "Something went wrong. Trying again shortly.",
    needsSettings: false,
    staleNotice: (age) => `Couldn't refresh. ${updated(age)}`,
  };
}
