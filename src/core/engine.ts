import {
  type Board,
  canPlaceAnywhere,
  clearCells,
  createBoard,
  findClears,
  fits,
  GRID,
  idx,
  isGameOver,
  place,
} from "./board";
import { Rng } from "./rng";
import { makePiece, type Piece, randomPiece } from "./shapes";
import { clearScore, levelFromLines, levelMultiplier, placeScore } from "./scoring";

export type Mode = "classic" | "daily";

export interface PlaceEvent {
  type: "place";
  slot: number;
  cells: number[];
  gx: number;
  gy: number;
  color: number;
}
export interface ClearEvent {
  type: "clear";
  cells: number[];
  colors: number[];
  rows: number[];
  cols: number[];
  lines: number;
  gained: number;
  streak: number;
}
export interface LevelUpEvent {
  type: "levelup";
  level: number;
}
export interface RefillEvent {
  type: "refill";
}
export interface GameOverEvent {
  type: "gameover";
  score: number;
}
export type GameEvent = PlaceEvent | ClearEvent | LevelUpEvent | RefillEvent | GameOverEvent;

export interface MoveResult {
  ok: boolean;
  events: GameEvent[];
}

const REVIVE_ROWS = 3;

export class GameEngine {
  readonly colorCount: number;
  board: Board = createBoard();
  tray: (Piece | null)[] = [null, null, null];

  score = 0;
  streak = 0;
  maxCombo = 0;
  linesTotal = 0;
  level = 1;

  mode: Mode = "classic";
  seed = 0;
  over = false;
  reviveUsed = false;

  private rng: Rng = new Rng();

  constructor(colorCount = 8) {
    this.colorCount = colorCount;
  }

  newGame(mode: Mode = "classic", seed?: number): void {
    this.mode = mode;
    this.seed = seed ?? (Math.random() * 2 ** 32) >>> 0;
    this.rng = new Rng(this.seed);
    this.board = createBoard();
    this.score = 0;
    this.streak = 0;
    this.maxCombo = 0;
    this.linesTotal = 0;
    this.level = 1;
    this.over = false;
    this.reviveUsed = false;
    this.refillTray();
  }

  multiplier(): number {
    return levelMultiplier(this.level);
  }

  filledRatio(): number {
    let n = 0;
    for (const v of this.board) if (v !== 0) n++;
    return n / this.board.length;
  }

  /** Whether a revive is currently offerable. */
  canOfferRevive(): boolean {
    return this.over && !this.reviveUsed;
  }

  fits(piece: Piece, gx: number, gy: number): boolean {
    return fits(this.board, piece, gx, gy);
  }

  canPlace(piece: Piece): boolean {
    return canPlaceAnywhere(this.board, piece);
  }

  // Generate a fresh tray guaranteed to have at least one placeable piece.
  private refillTray(): void {
    for (let attempt = 0; attempt < 40; attempt++) {
      const cand = [
        randomPiece(this.rng, this.colorCount),
        randomPiece(this.rng, this.colorCount),
        randomPiece(this.rng, this.colorCount),
      ];
      if (cand.some((p) => canPlaceAnywhere(this.board, p))) {
        this.tray = cand;
        return;
      }
    }
    // Fallback: a single 1x1 always fits while any cell is empty.
    this.tray = [
      randomPiece(this.rng, this.colorCount),
      randomPiece(this.rng, this.colorCount),
      makePiece([[0, 0]], this.rng.int(this.colorCount)),
    ];
  }

  /** Attempt to place tray[slot] at grid (gx,gy). */
  tryPlace(slot: number, gx: number, gy: number): MoveResult {
    const piece = this.tray[slot];
    if (this.over || !piece || !fits(this.board, piece, gx, gy)) {
      return { ok: false, events: [] };
    }

    const events: GameEvent[] = [];
    const cells = place(this.board, piece, gx, gy);
    this.score += placeScore(piece.cells.length);
    this.tray[slot] = null;
    events.push({ type: "place", slot, cells, gx, gy, color: piece.color });

    const clip = findClears(this.board);
    if (clip.lines > 0) {
      this.streak++;
      this.maxCombo = Math.max(this.maxCombo, this.streak);
      this.linesTotal += clip.lines;

      const newLevel = levelFromLines(this.linesTotal);
      const leveled = newLevel > this.level;
      this.level = newLevel;

      const gained = clearScore({
        clearedCellCount: clip.cells.length,
        lines: clip.lines,
        streak: this.streak,
        level: this.level,
      });
      this.score += gained;
      const colors = clip.cells.map((c) => this.board[c] - 1);
      clearCells(this.board, clip.cells);

      events.push({
        type: "clear",
        cells: clip.cells,
        colors,
        rows: clip.rows,
        cols: clip.cols,
        lines: clip.lines,
        gained,
        streak: this.streak,
      });
      if (leveled) events.push({ type: "levelup", level: this.level });
    } else {
      this.streak = 0;
    }

    if (this.tray.every((p) => !p)) {
      this.refillTray();
      events.push({ type: "refill" });
    }

    if (isGameOver(this.board, this.tray)) {
      this.over = true;
      events.push({ type: "gameover", score: Math.floor(this.score) });
    }

    return { ok: true, events };
  }

  /** Clear the bottom rows to give the player another chance (one per game). */
  revive(): boolean {
    if (!this.canOfferRevive()) return false;
    this.reviveUsed = true;
    const start = GRID - REVIVE_ROWS;
    for (let y = start; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) this.board[idx(x, y)] = 0;
    }
    this.streak = 0;
    if (isGameOver(this.board, this.tray)) this.refillTray();
    this.over = false;
    return true;
  }
}
