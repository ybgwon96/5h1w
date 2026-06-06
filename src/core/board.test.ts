import { describe, expect, it } from "vitest";
import {
  canPlaceAnywhere,
  clearCells,
  createBoard,
  filledCount,
  findClears,
  fits,
  GRID,
  idx,
  isGameOver,
  place,
} from "./board";
import { makePiece } from "./shapes";

const single = makePiece([[0, 0]], 0);
const hLine3 = makePiece(
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  1
);

describe("fits", () => {
  it("accepts an in-bounds placement on empty cells", () => {
    const b = createBoard();
    expect(fits(b, hLine3, 0, 0)).toBe(true);
    expect(fits(b, hLine3, 5, 0)).toBe(true);
  });

  it("rejects out-of-bounds placements", () => {
    const b = createBoard();
    expect(fits(b, hLine3, 6, 0)).toBe(false); // 6,7,8 -> 8 is OOB
    expect(fits(b, single, -1, 0)).toBe(false);
    expect(fits(b, single, 0, GRID)).toBe(false);
  });

  it("rejects overlapping placements", () => {
    const b = createBoard();
    place(b, single, 1, 0);
    expect(fits(b, hLine3, 0, 0)).toBe(false);
  });
});

describe("place", () => {
  it("fills cells with colour+1 and returns indices", () => {
    const b = createBoard();
    const filled = place(b, hLine3, 0, 0);
    expect(filled).toEqual([idx(0, 0), idx(1, 0), idx(2, 0)]);
    expect(b[idx(0, 0)]).toBe(2); // color 1 -> 2
    expect(filledCount(b)).toBe(3);
  });
});

describe("findClears", () => {
  it("detects a full row", () => {
    const b = createBoard();
    for (let x = 0; x < GRID; x++) b[idx(x, 3)] = 1;
    const r = findClears(b);
    expect(r.rows).toEqual([3]);
    expect(r.cols).toEqual([]);
    expect(r.lines).toBe(1);
    expect(r.cells).toHaveLength(GRID);
  });

  it("detects a full column", () => {
    const b = createBoard();
    for (let y = 0; y < GRID; y++) b[idx(2, y)] = 1;
    const r = findClears(b);
    expect(r.cols).toEqual([2]);
    expect(r.lines).toBe(1);
  });

  it("counts overlapping row+col cells only once", () => {
    const b = createBoard();
    for (let x = 0; x < GRID; x++) b[idx(x, 0)] = 1;
    for (let y = 0; y < GRID; y++) b[idx(0, y)] = 1;
    const r = findClears(b);
    expect(r.lines).toBe(2);
    expect(r.cells).toHaveLength(GRID * 2 - 1); // shared corner counted once
  });

  it("returns nothing for an incomplete board", () => {
    const b = createBoard();
    for (let x = 0; x < GRID - 1; x++) b[idx(x, 0)] = 1;
    expect(findClears(b).lines).toBe(0);
  });
});

describe("clearCells", () => {
  it("empties the given cells", () => {
    const b = createBoard();
    for (let x = 0; x < GRID; x++) b[idx(x, 0)] = 1;
    const { cells } = findClears(b);
    clearCells(b, cells);
    expect(filledCount(b)).toBe(0);
  });
});

describe("canPlaceAnywhere / isGameOver", () => {
  it("a 1x1 fits while a cell is empty", () => {
    const b = createBoard();
    expect(canPlaceAnywhere(b, single)).toBe(true);
  });

  it("nothing fits on a full board", () => {
    const b = createBoard().map(() => 1);
    expect(canPlaceAnywhere(b, single)).toBe(false);
    expect(isGameOver(b, [single, single, single])).toBe(true);
  });

  it("game is not over if any piece fits", () => {
    const b = createBoard().map(() => 1);
    b[idx(0, 0)] = 0;
    expect(isGameOver(b, [hLine3, single, null])).toBe(false); // single fits
  });
});
