import { AtApiError } from "@/features/train-tracker/api/at-client";

/** User-facing copy for a failed arrivals fetch. Never includes error details. */
export function describeArrivalsError(error: unknown): {
  title: string;
  detail: string;
} {
  if (error instanceof AtApiError) {
    switch (error.kind) {
      case "missing-key":
        return {
          title: "Add your AT API key.",
          detail:
            "Live trains need an Auckland Transport API key, saved securely on this device.",
        };
      case "unauthorized":
        return {
          title: "Your AT API key was rejected.",
          detail: "Check the key in your Auckland Transport developer account.",
        };
      case "rate-limited":
        return {
          title: "Auckland Transport is busy.",
          detail: "Too many requests right now. Trying again shortly.",
        };
      case "network":
        return {
          title: "Can't reach Auckland Transport.",
          detail: "Check your connection. Trying again shortly.",
        };
    }
  }
  return {
    title: "Couldn't load trains.",
    detail: "Something went wrong. Trying again shortly.",
  };
}
