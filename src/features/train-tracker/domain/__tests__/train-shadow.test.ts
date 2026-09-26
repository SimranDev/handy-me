import { trainShadow } from "@/features/train-tracker/domain/train-shadow";

describe("trainShadow", () => {
  it("is long at dawn and dusk, short at midday, faint at night", () => {
    const [night, dawn, midday, dusk] = [0, 1, 2, 3].map((p) =>
      trainShadow(p, null),
    );
    expect(dawn.length).toBe(16);
    expect(dusk.length).toBe(16);
    expect(midday.length).toBe(5);
    expect(night.length).toBe(8);
    expect(night.opacity).toBeLessThan(dawn.opacity);
    expect(midday.opacity).toBeGreaterThan(dawn.opacity);
  });

  it("falls away from the light", () => {
    expect(trainShadow(1, 330).shift).toBeLessThan(0); // sun in the east (right)
    expect(trainShadow(3, 45).shift).toBeGreaterThan(0); // sun in the west (left)
    expect(trainShadow(2, 195).shift).toBe(0); // overhead
  });

  it("leans fully once the light is well to one side", () => {
    const dawn = trainShadow(1, 330);
    expect(dawn.shift).toBeCloseTo(-Math.tan((58 * Math.PI) / 180) * 16);
    expect(trainShadow(1, 500).shift).toBeCloseTo(dawn.shift);
  });

  it("blends between palettes and clamps outside the day", () => {
    expect(trainShadow(1.5, null).length).toBeCloseTo(10.5);
    expect(trainShadow(-1, null)).toEqual(trainShadow(0, null));
    expect(trainShadow(9, null)).toEqual(trainShadow(4, null));
  });
});
