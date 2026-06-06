import { getJSON, setJSON } from "./storage";

export interface Stats {
  games: number;
  totalLines: number;
  bestScore: number;
  bestCombo: number;
  bestLevel: number;
}

const KEY = "stats";

export function defaultStats(): Stats {
  return { games: 0, totalLines: 0, bestScore: 0, bestCombo: 0, bestLevel: 1 };
}

export function loadStats(): Stats {
  return getJSON<Stats>(KEY, defaultStats());
}

export interface RunResult {
  score: number;
  lines: number;
  combo: number;
  level: number;
}

/** Fold a finished run into the persistent stats. Returns the updated stats
 *  and whether a new best score was set. */
export function recordRun(result: RunResult): { stats: Stats; newBest: boolean } {
  const stats = loadStats();
  stats.games += 1;
  stats.totalLines += result.lines;
  const newBest = result.score > stats.bestScore;
  stats.bestScore = Math.max(stats.bestScore, Math.floor(result.score));
  stats.bestCombo = Math.max(stats.bestCombo, result.combo);
  stats.bestLevel = Math.max(stats.bestLevel, result.level);
  setJSON(KEY, stats);
  return { stats, newBest };
}
