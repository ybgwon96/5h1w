import type { Rng } from "./rng";

export type Coord = [number, number];

export interface Piece {
  cells: Coord[];
  /** Palette colour index. */
  color: number;
  /** Bounding-box width in cells. */
  w: number;
  /** Bounding-box height in cells. */
  h: number;
}

// Base polyomino shapes (cell offsets). Rotations are generated at load time.
export const BASE_SHAPES: Coord[][] = [
  [[0, 0]],
  [
    [0, 0],
    [1, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
];

export function normalize(cells: Coord[]): Coord[] {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY] as Coord);
}

function rotate(cells: Coord[]): Coord[] {
  return normalize(cells.map(([x, y]) => [-y, x] as Coord));
}

function key(cells: Coord[]): string {
  return [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]).join("|");
}

/** All unique rotations (0/90/180/270) of a shape. */
export function rotations(base: Coord[]): Coord[][] {
  const out: Coord[][] = [];
  const seen = new Set<string>();
  let cur = normalize(base);
  for (let i = 0; i < 4; i++) {
    const k = key(cur);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(cur);
    }
    cur = rotate(cur);
  }
  return out;
}

export const SHAPE_ROTATIONS: Coord[][][] = BASE_SHAPES.map(rotations);

export function makePiece(cells: Coord[], color: number): Piece {
  const w = Math.max(...cells.map((c) => c[0])) + 1;
  const h = Math.max(...cells.map((c) => c[1])) + 1;
  return { cells: cells.map((c) => [c[0], c[1]] as Coord), color, w, h };
}

/** A random piece (random shape, rotation and colour) from the given RNG. */
export function randomPiece(rng: Rng, colorCount: number): Piece {
  const rots = rng.pick(SHAPE_ROTATIONS);
  const cells = rng.pick(rots);
  return makePiece(cells, rng.int(colorCount));
}
