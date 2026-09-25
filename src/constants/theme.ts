import "@/global.css";

import { Platform } from "react-native";

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

/**
 * Me Simplified · Horizon palette. The whole app follows the time of day:
 * each phase recolours the sky scene, the card below it and the tab bar.
 */
export type Phase = "dawn" | "midday" | "dusk" | "night";

export type PhaseTheme = {
  sky: string;
  ink: string;
  ink2: string;
  orb: string;
  hill1: string;
  hill2: string;
  ground: string;
  track: string;
  train: string;
  win: string;
  you: string;
  label: string;
  beam: string;
  card: string;
  cardInk: string;
  cardInk2: string;
  rule: string;
  muted: string;
  late: string;
  /** Tab bar background (the card colour at 90%). */
  glass: string;
  /** Hatching used on placeholder screens. */
  stripe: string;
};

export const PhaseThemes: Record<Phase, PhaseTheme> = {
  dawn: {
    sky: "#FCE0CE",
    ink: "#1F3A2E",
    ink2: "#4E4236",
    orb: "#F4A15D",
    hill1: "#B8D4B1",
    hill2: "#A3C79E",
    ground: "#6FA389",
    track: "#1F3A2E",
    train: "#1F3A2E",
    win: "#FCE0CE",
    you: "#1F3A2E",
    label: "#FFFFFF",
    beam: "transparent",
    card: "#FBF4EE",
    cardInk: "#1F3A2E",
    cardInk2: "#4A4A44",
    rule: "#E6DDD4",
    muted: "#8A8680",
    late: "#B35A00",
    glass: "rgba(251,244,238,0.9)",
    stripe: "rgba(31,58,46,0.07)",
  },
  midday: {
    sky: "#D3E7F2",
    ink: "#1B2F4E",
    ink2: "#33476A",
    orb: "#FFC94A",
    hill1: "#ABD49C",
    hill2: "#8CC47E",
    ground: "#5E9E68",
    track: "#1B2F4E",
    train: "#1B2F4E",
    win: "#D3E7F2",
    you: "#1B2F4E",
    label: "#FFFFFF",
    beam: "transparent",
    card: "#F3F7FA",
    cardInk: "#1B2F4E",
    cardInk2: "#3E4A5C",
    rule: "#DCE4EA",
    muted: "#848C96",
    late: "#B35A00",
    glass: "rgba(243,247,250,0.9)",
    stripe: "rgba(27,47,78,0.07)",
  },
  dusk: {
    sky: "#F2B094",
    ink: "#2E2240",
    ink2: "#4A3452",
    orb: "#E4604A",
    hill1: "#9F7B9B",
    hill2: "#7E5E87",
    ground: "#4D3E5E",
    track: "#2E2240",
    train: "#2E2240",
    win: "#F7C86A",
    you: "#2E2240",
    label: "#FFFFFF",
    beam: "#C9A58F",
    card: "#FBF0EC",
    cardInk: "#2E2240",
    cardInk2: "#54485C",
    rule: "#EBDDD8",
    muted: "#8C8290",
    late: "#B8401F",
    glass: "rgba(251,240,236,0.9)",
    stripe: "rgba(46,34,64,0.07)",
  },
  night: {
    sky: "#1E2340",
    ink: "#EEF0F8",
    ink2: "#C4C8DC",
    orb: "#F3EBCB",
    hill1: "#2D3556",
    hill2: "#262D4A",
    ground: "#1B1F36",
    track: "#D5D8E6",
    train: "#0F1226",
    win: "#F7C86A",
    you: "#C9CDE0",
    label: "#FFFFFF",
    beam: "#6C6A70",
    card: "#161A2E",
    cardInk: "#FFFFFF",
    cardInk2: "#BCC0D4",
    rule: "#2A2F48",
    muted: "#9AA0B8",
    late: "#F29A6B",
    glass: "rgba(22,26,46,0.9)",
    stripe: "rgba(255,255,255,0.06)",
  },
};

export function phaseFor(hour: number): Phase {
  if (hour >= 5 && hour < 10) return "dawn";
  if (hour >= 10 && hour < 17) return "midday";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

/** Font families loaded in the root layout (see `src/app/_layout.tsx`). */
export const FontFamily = {
  sans: "DMSans_400Regular",
  sansMedium: "DMSans_500Medium",
  sansBold: "DMSans_700Bold",
  serif: "Fraunces_500Medium",
  serifSemiBold: "Fraunces_600SemiBold",
} as const;
