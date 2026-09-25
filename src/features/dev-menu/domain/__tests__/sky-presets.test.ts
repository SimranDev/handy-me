import { skyAt } from "@/domain/sky";
import { formatClock } from "@/domain/time";
import { skyPresets } from "@/features/dev-menu/domain/sky-presets";

describe("skyPresets", () => {
  it("lists the day's moments in order, on Auckland's clock", () => {
    const presets = skyPresets("2026-12-21");
    expect(presets.map((p) => [p.label, formatClock(p.at)])).toEqual([
      ["Midnight", "00:00"],
      ["Dawn", "05:27"],
      ["Sunrise", "05:58"],
      ["Noon", expect.any(String)],
      ["Sunset", "20:39"],
      ["Dusk", "21:10"],
    ]);
    const times = presets.map((p) => p.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("covers every palette", () => {
    const phases = skyPresets("2026-06-21").map((p) => skyAt(p.at).phase);
    expect(new Set(phases)).toEqual(
      new Set(["night", "dawn", "midday", "dusk"]),
    );
  });
});
