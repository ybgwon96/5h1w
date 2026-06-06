import { describe, expect, it } from "vitest";
import { dailyKey, Rng, seedFromString } from "./rng";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it("returns floats in [0,1)", () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(n) stays in range", () => {
    const r = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(8);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(8);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("pick selects from the array", () => {
    const r = new Rng(3);
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) expect(arr).toContain(r.pick(arr));
  });
});

describe("seedFromString", () => {
  it("is stable and unsigned", () => {
    expect(seedFromString("2026-06-06")).toBe(seedFromString("2026-06-06"));
    expect(seedFromString("a")).not.toBe(seedFromString("b"));
    expect(seedFromString("anything")).toBeGreaterThanOrEqual(0);
  });
});

describe("dailyKey", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(dailyKey(new Date(2026, 0, 9))).toBe("2026-01-09");
    expect(dailyKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
