import type { Piece } from "./shapes";

export const GRID = 8;
export const CELL_COUNT = GRID * GRID;

/** Board cells: 0 = empty, otherwise paletteIndex + 1. */
export type Board = number[];

export function createBoard(): Board {
  return new Array(CELL_COUNT).fill(0);
}

export function idx(x: number, y: number): number {
  return y * GRID + x;
}

export function fits(board: Board, piece: Piece, gx: number, gy: number): boolean {
  for (const [ox, oy] of piece.cells) {
    const x = gx + ox;
    const y = gy + oy;
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) return false;
    if (board[idx(x, y)] !== 0) return false;
  }
  return true;
}

/** Place a piece (mutates board). Returns the indices that were filled. */
export function place(board: Board, piece: Piece, gx: number, gy: number): number[] {
  const filled: number[] = [];
  for (const [ox, oy] of piece.cells) {
    const i = idx(gx + ox, gy + oy);
    board[i] = piece.color + 1;
    filled.push(i);
  }
  return filled;
}

export interface ClearResult {
  rows: number[];
  cols: number[];
  cells: number[];
  lines: number;
}

export function findClears(board: Board): ClearResult {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let y = 0; y < GRID; y++) {
    let full = true;
    for (let x = 0; x < GRID; x++) if (board[idx(x, y)] === 0) full = false;
    if (full) rows.push(y);
  }
  for (let x = 0; x < GRID; x++) {
    let full = true;
    for (let y = 0; y < GRID; y++) if (board[idx(x, y)] === 0) full = false;
    if (full) cols.push(x);
  }
  const set = new Set<number>();
  for (const y of rows) for (let x = 0; x < GRID; x++) set.add(idx(x, y));
  for (const x of cols) for (let y = 0; y < GRID; y++) set.add(idx(x, y));
  return { rows, cols, cells: [...set], lines: rows.length + cols.length };
}

/** Clear the given cell indices (mutates board). */
export function clearCells(board: Board, cells: number[]): void {
  for (const c of cells) board[c] = 0;
}

export function canPlaceAnywhere(board: Board, piece: Piece): boolean {
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      if (fits(board, piece, gx, gy)) return true;
    }
  }
  return false;
}

/** True if none of the (non-null) pieces can be placed anywhere. */
export function isGameOver(board: Board, pieces: readonly (Piece | null)[]): boolean {
  return !pieces.some((p) => p && canPlaceAnywhere(board, p));
}

export function filledCount(board: Board): number {
  let n = 0;
  for (const v of board) if (v !== 0) n++;
  return n;
}
