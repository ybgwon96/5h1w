export const LINES_PER_LEVEL = 8;

export function levelFromLines(totalLines: number): number {
  return 1 + Math.floor(totalLines / LINES_PER_LEVEL);
}

export function levelMultiplier(level: number): number {
  return 1 + (level - 1) * 0.2;
}

export interface ClearScoreInput {
  clearedCellCount: number;
  lines: number;
  /** Streak count AFTER incrementing for this clear (>= 1). */
  streak: number;
  level: number;
}

/**
 * Score gained from a line clear.
 *   base    = cells * 10
 *   combo   = base * (number of lines cleared at once)
 *   streak  = +15 per consecutive clearing move beyond the first
 *   level   = scaled by the level multiplier
 */
export function clearScore({ clearedCellCount, lines, streak, level }: ClearScoreInput): number {
  const base = clearedCellCount * 10;
  const comboMult = lines;
  const streakBonus = (streak - 1) * 15;
  return Math.round((base * comboMult + streakBonus) * levelMultiplier(level));
}

/** Points for simply placing a piece (one per cell). */
export function placeScore(cellCount: number): number {
  return cellCount;
}
