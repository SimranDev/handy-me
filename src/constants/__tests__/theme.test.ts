import {
  type Appearance,
  blendTheme,
  contrastRatio,
  PhaseThemes,
  type UiTheme,
  UiThemes,
} from "@/constants/theme";

const sweep = Array.from({ length: 401 }, (_, i) => i / 100); // 0 → 4
const appearances: Appearance[] = ["light", "dark"];

describe("blendTheme", () => {
  it("matches the original scene palettes at each phase", () => {
    const rgb = (hex: string) =>
      `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")}, 1)`;
    expect(blendTheme(0).sky).toBe(rgb(PhaseThemes.night.sky));
    expect(blendTheme(1).orb).toBe(rgb(PhaseThemes.dawn.orb));
    expect(blendTheme(2).hill1).toBe(rgb(PhaseThemes.midday.hill1));
    expect(blendTheme(3).orb).toBe(rgb(PhaseThemes.dusk.orb));
  });

  it("takes the app surfaces from light or dark mode, whatever the time", () => {
    for (const appearance of appearances) {
      for (const p of [0, 1.5, 2, 3.5]) {
        expect(blendTheme(p, appearance).card).toBe(UiThemes[appearance].card);
      }
    }
  });

  it("keeps text on the blending sky at least large-text legible (3:1)", () => {
    // Mid-twilight the sky itself is mid-toned; ~3.3:1 is the floor.
    const worst = (fg: "ink" | "ink2") =>
      Math.min(
        ...sweep.map((p) => {
          const t = blendTheme(p);
          return contrastRatio(t[fg], t.sky);
        }),
      );
    expect(worst("ink")).toBeGreaterThan(3);
    expect(worst("ink2")).toBeGreaterThan(3);
  });
});

/** A translucent "rgba(…)" colour laid over an opaque "#rrggbb" one. */
function over(top: string, base: string): string {
  const [r, g, b, a] = (top.match(/[\d.]+/g) ?? []).map(Number);
  const channel = (i: number, c: number) =>
    Math.round(c * a + parseInt(base.slice(i, i + 2), 16) * (1 - a));
  return `rgb(${channel(1, r)}, ${channel(3, g)}, ${channel(5, b)})`;
}

describe("UiThemes", () => {
  it.each(appearances)("keeps %s-mode text readable (WCAG AA)", (mode) => {
    const t = UiThemes[mode];
    // Surfaces text sits on: the page, the soft panel and a selected row
    // (tinted in sheets). The active row on the Settings profiles page is
    // the rule colour; late text never appears there.
    const surfaces = [t.card, t.soft, over(t.selection, t.card)];
    const worst = (fg: keyof UiTheme, on = surfaces) =>
      Math.min(...on.map((bg) => contrastRatio(t[fg], bg)));
    const withRule = [...surfaces, t.rule];
    expect(worst("cardInk", withRule)).toBeGreaterThan(7);
    expect(contrastRatio(t.cardInk, t.glass)).toBeGreaterThan(7);
    expect(worst("cardInk2", withRule)).toBeGreaterThan(4.5);
    expect(worst("muted", withRule)).toBeGreaterThan(4.5);
    expect(worst("late")).toBeGreaterThan(4.5);
  });
});
