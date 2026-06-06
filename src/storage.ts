// Tiny wrapper around localStorage so the rest of the game never has to
// worry about private-mode exceptions or missing keys.
const BEST_KEY = "block-blast:best";
const MUTE_KEY = "block-blast:muted";

export function getBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function setBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch {
    /* ignore */
  }
}

export function getMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}
