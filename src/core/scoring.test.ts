import { describe, expect, it } from "vitest";
import {
  clearScore,
  levelFromLines,
  levelMultiplier,
  LINES_PER_LEVEL,
  placeScore,
} from "./scoring";

describe("levelFromLines", () => {
  it("levels up every LINES_PER_LEVEL lines", () => {
    expect(levelFromLines(0)).toBe(1);
    expect(levelFromLines(LINES_PER_LEVEL - 1)).toBe(1);
    expect(levelFromLines(LINES_PER_LEVEL)).toBe(2);
    expect(levelFromLines(LINES_PER_LEVEL * 2)).toBe(3);
  });
});

describe("levelMultiplier", () => {
  it("grows 0.2 per level", () => {
    expect(levelMultiplier(1)).toBeCloseTo(1.0);
    expect(levelMultiplier(2)).toBeCloseTo(1.2);
    expect(levelMultiplier(3)).toBeCloseTo(1.4);
  });
});

describe("clearScore", () => {
  it("one 8-cell line at level 1, no streak = 80", () => {
    expect(clearScore({ clearedCellCount: 8, lines: 1, streak: 1, level: 1 })).toBe(80);
  });

  it("adds a streak bonus", () => {
    expect(clearScore({ clearedCellCount: 8, lines: 1, streak: 2, level: 1 })).toBe(95);
  });

  it("multiplies two lines (combo)", () => {
    // base 160 * combo 2 + streak 0 = 320
    expect(clearScore({ clearedCellCount: 16, lines: 2, streak: 1, level: 1 })).toBe(320);
  });

  it("applies the level multiplier", () => {
    // (80 + 15) * 1.2 = 114
    expect(clearScore({ clearedCellCount: 8, lines: 1, streak: 2, level: 2 })).toBe(114);
  });
});

describe("placeScore", () => {
  it("is one point per cell", () => {
    expect(placeScore(4)).toBe(4);
  });
});
