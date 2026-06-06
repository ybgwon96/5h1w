import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import {
  BASE_SHAPES,
  makePiece,
  normalize,
  randomPiece,
  rotations,
  SHAPE_ROTATIONS,
} from "./shapes";

describe("normalize", () => {
  it("shifts cells so min x/y are 0", () => {
    const n = normalize([
      [2, 3],
      [3, 3],
    ]);
    expect(n).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });
});

describe("rotations", () => {
  it("single cell has 1 unique rotation", () => {
    expect(rotations([[0, 0]])).toHaveLength(1);
  });

  it("2x2 square has 1 unique rotation", () => {
    expect(
      rotations([
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ])
    ).toHaveLength(1);
  });

  it("a straight tromino has 2 unique rotations", () => {
    expect(
      rotations([
        [0, 0],
        [1, 0],
        [2, 0],
      ])
    ).toHaveLength(2);
  });

  it("an L-tetromino has 4 unique rotations", () => {
    expect(
      rotations([
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
      ])
    ).toHaveLength(4);
  });

  it("every base shape produces 1-4 rotations", () => {
    for (const set of SHAPE_ROTATIONS) {
      expect(set.length).toBeGreaterThanOrEqual(1);
      expect(set.length).toBeLessThanOrEqual(4);
    }
    expect(SHAPE_ROTATIONS).toHaveLength(BASE_SHAPES.length);
  });
});

describe("makePiece", () => {
  it("computes the bounding box", () => {
    const p = makePiece(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      2
    );
    expect(p.w).toBe(2);
    expect(p.h).toBe(2);
    expect(p.color).toBe(2);
    expect(p.cells).toHaveLength(3);
  });
});

describe("randomPiece", () => {
  it("is deterministic for a seed and within colour range", () => {
    const p1 = randomPiece(new Rng(42), 8);
    const p2 = randomPiece(new Rng(42), 8);
    expect(p1).toEqual(p2);
    expect(p1.color).toBeGreaterThanOrEqual(0);
    expect(p1.color).toBeLessThan(8);
  });
});
