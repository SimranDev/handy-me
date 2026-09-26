import "@/global.css";

import { Platform } from "react-native";
import { interpolateColor } from "react-native-reanimated";

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
 * Handy Me · Horizon palette, in two layers:
 * - the scene (sky, hills, train, station) follows the time of day, blending
 *   through four phase palettes;
 * - the app's surfaces (cards, tab bar, the text on them) follow the phone's
 *   light or dark mode.
 */
export type Phase = "dawn" | "midday" | "dusk" | "night";
export type Appearance = "light" | "dark";

/** Colours drawn in the sky scene, and the text over it. */
export type SceneTheme = {
  sky: string;
  ink: string;
  ink2: string;
  orb: string;
  hill1: string;
  hill2: string;
  ground: string;
  track: string;
  /** Train body, windows, pantograph (drawn against the sky) and headlight. */
  train: string;
  trainWin: string;
  pantograph: string;
  headlight: string;
  /** Your station's building and its windows (lit after dark). */
  station: string;
  win: string;
  you: string;
  label: string;
  beam: string;
};

/** App surfaces and their text. */
export type UiTheme = {
  card: string;
  cardInk: string;
  cardInk2: string;
  rule: string;
  muted: string;
  late: string;
  /** A softer surface on the card, for panels like the setup checklist. */
  soft: string;
  /** Background of the selected row in a list. */
  selection: string;
  /** Tab bar background. */
  glass: string;
  /** Hatching used on placeholder screens. */
  stripe: string;
};

export type AppTheme = SceneTheme & UiTheme;

export const PhaseThemes: Record<Phase, SceneTheme> = {
  dawn: {
    sky: "#FCE0CE",
    ink: "#1F3A2E",
    ink2: "#4E4236",
    orb: "#F4A15D",
    hill1: "#B8D4B1",
    hill2: "#A3C79E",
    ground: "#6FA389",
    track: "#1F3A2E",
    train: "#F4F5F2",
    trainWin: "#5A6472",
    pantograph: "#2A2E35",
    headlight: "#E9E4CF",
    station: "#1F3A2E",
    win: "#FCE0CE",
    you: "#1F3A2E",
    label: "#FFFFFF",
    beam: "transparent",
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
    train: "#F4F5F2",
    trainWin: "#5A6472",
    pantograph: "#2A2E35",
    headlight: "#E9E4CF",
    station: "#1B2F4E",
    win: "#D3E7F2",
    you: "#1B2F4E",
    label: "#FFFFFF",
    beam: "transparent",
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
    train: "#F4F5F2",
    trainWin: "#F7C86A",
    pantograph: "#2A2E35",
    headlight: "#FFF1BF",
    station: "#2E2240",
    win: "#FFD27A",
    you: "#2E2240",
    label: "#FFFFFF",
    beam: "#C9A58F",
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
    train: "#B7BCC9",
    trainWin: "#F7C86A",
    pantograph: "#B7BCC9",
    headlight: "#FFF1BF",
    station: "#0E1124",
    win: "#FFD27A",
    you: "#C9CDE0",
    label: "#FFFFFF",
    beam: "#EDD79F",
  },
};

/** The "paper" palette: warm off-white by day, near-black in dark mode. */
export const UiThemes: Record<Appearance, UiTheme> = {
  light: {
    card: "#F6F3EE",
    cardInk: "#1D2621",
    cardInk2: "#4B4F4A",
    rule: "#E4DED5",
    muted: "#5F5C56",
    late: "#A34F00",
    soft: "#ECE6DC",
    selection: "rgba(29,38,33,0.06)",
    glass: "#F6F3EE",
    stripe: "rgba(29,38,33,0.07)",
  },
  dark: {
    card: "#141614",
    cardInk: "#F1EEE8",
    cardInk2: "#B9B6AE",
    rule: "#2A2D2A",
    muted: "#9A978F",
    late: "#F0A060",
    soft: "#1E211E",
    selection: "rgba(255,255,255,0.06)",
    glass: "#141614",
    stripe: "rgba(255,255,255,0.06)",
  },
};

const BLEND_ORDER: readonly SceneTheme[] = [
  PhaseThemes.night,
  PhaseThemes.dawn,
  PhaseThemes.midday,
  PhaseThemes.dusk,
  PhaseThemes.night,
];
const BLEND_STOPS = [0, 1, 2, 3, 4];

/**
 * The scene palette for a sky `progress` (see `Sky` in src/domain/sky.ts),
 * blending night → dawn → midday → dusk → night, with the app surfaces for
 * `appearance`.
 *
 * - Scene colours (sky, hills, sun, train…) blend continuously.
 * - Between a light palette and night, text drawn on the sky takes whichever
 *   neighbouring text colour reads best against the current sky, rather
 *   than passing through unreadable mid-grey.
 * - The beam only exists after dark (dawn/midday have it "transparent"), so
 *   it blends dusk → night and is faded with `sky.lights` instead.
 */
export function blendTheme(
  progress: number,
  appearance: Appearance = "light",
): AppTheme {
  const p = Math.min(4, Math.max(0, progress));
  const segment = Math.min(3, Math.floor(p));
  const from = BLEND_ORDER[segment];
  const to = BLEND_ORDER[segment + 1];
  const crossesDark =
    (from === PhaseThemes.night) !== (to === PhaseThemes.night);

  const blend = (key: keyof SceneTheme) =>
    interpolateColor(
      p,
      BLEND_STOPS,
      BLEND_ORDER.map((t) => t[key]),
    ) as string;

  const scene = {} as SceneTheme;
  for (const key of Object.keys(PhaseThemes.night) as (keyof SceneTheme)[]) {
    if (key === "beam") {
      scene.beam = interpolateColor(
        Math.min(4, Math.max(3, p)),
        [3, 4],
        [PhaseThemes.dusk.beam, PhaseThemes.night.beam],
      ) as string;
    } else if (key !== "ink" && key !== "ink2") {
      scene[key] = blend(key);
    }
  }

  if (crossesDark) {
    // Secondary sky text may borrow the primary ink when that reads better.
    const inks = [from.ink, to.ink];
    scene.ink = mostLegible(inks, scene.sky);
    scene.ink2 = mostLegible([from.ink2, to.ink2, ...inks], scene.sky);
  } else {
    scene.ink = blend("ink");
    scene.ink2 = blend("ink2");
  }
  return { ...scene, ...UiThemes[appearance] };
}

function mostLegible(colors: string[], background: string): string {
  return colors.reduce((best, c) =>
    contrastRatio(c, background) > contrastRatio(best, background) ? c : best,
  );
}

/** WCAG contrast ratio between two colours ("#rrggbb" or "rgb(a)(…)"). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function luminance(color: string): number {
  const rgb = color.startsWith("#")
    ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
    : (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Font families loaded in the root layout (see `src/app/_layout.tsx`). */
export const FontFamily = {
  sans: "Geist_400Regular",
  sansMedium: "Geist_500Medium",
  sansSemiBold: "Geist_600SemiBold",
  sansBold: "Geist_700Bold",
} as const;
