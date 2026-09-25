import {
  blendTheme,
  contrastRatio,
  type PhaseTheme,
  PhaseThemes,
} from "@/constants/theme";

const sweep = Array.from({ length: 401 }, (_, i) => i / 100); // 0 → 4

describe("blendTheme", () => {
  it("matches the original palettes at each phase", () => {
    const rgb = (hex: string) =>
      `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")}, 1)`;
    expect(blendTheme(0).sky).toBe(rgb(PhaseThemes.night.sky));
    expect(blendTheme(1).card).toBe(rgb(PhaseThemes.dawn.card));
    expect(blendTheme(2).hill1).toBe(rgb(PhaseThemes.midday.hill1));
    expect(blendTheme(3).orb).toBe(rgb(PhaseThemes.dusk.orb));
  });

  const worst = (fg: keyof PhaseTheme, bg: keyof PhaseTheme) =>
    Math.min(
      ...sweep.map((p) => {
        const t = blendTheme(p);
        return contrastRatio(t[fg], t[bg]);
      }),
    );

  const paletteFloor = (fg: keyof PhaseTheme) =>
    Math.min(
      ...Object.values(PhaseThemes).map((t) => contrastRatio(t[fg], t.card)),
    ) - 0.01; // blending text and card together can dip a hair below either end

  it("never lets card or tab-bar text fade into its background", () => {
    // Chrome switches light/dark at mid-twilight instead of passing through grey,
    // so it is always as readable as the original palettes.
    expect(worst("cardInk", "card")).toBeGreaterThan(11);
    expect(worst("cardInk2", "card")).toBeGreaterThan(7.5);
    expect(worst("cardInk", "glass")).toBeGreaterThan(11);
    // Muted and late text are only as strong as the palettes make them.
    expect(worst("muted", "card")).toBeGreaterThanOrEqual(
      paletteFloor("muted"),
    );
    expect(worst("late", "card")).toBeGreaterThanOrEqual(paletteFloor("late"));
  });

  it("keeps text on the blending sky at least large-text legible (3:1)", () => {
    // Mid-twilight the sky itself is mid-toned; ~3.3:1 is the floor.
    expect(worst("ink", "sky")).toBeGreaterThan(3);
    expect(worst("ink2", "sky")).toBeGreaterThan(3);
  });
});
