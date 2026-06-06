// Tiny wrapper around localStorage so the rest of the game never has to
// worry about private-mode exceptions or missing keys.
const BEST_KEY = "block-blast:best";
const MUTE_KEY = "block-blast:muted";
const COMBO_KEY = "block-blast:bestCombo";
const SEEN_KEY = "block-blast:seen";

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

export function getBestCombo(): number {
  try {
    return Number(localStorage.getItem(COMBO_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function setBestCombo(combo: number): void {
  try {
    localStorage.setItem(COMBO_KEY, String(Math.floor(combo)));
  } catch {
    /* ignore */
  }
}

/** True once the player has finished their first placement (tutorial seen). */
export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}
