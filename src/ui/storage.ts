// Namespaced, exception-safe localStorage helpers. Everything the game
// persists goes through here so private-mode / quota errors never crash.
const PREFIX = "block-blast:";

export function getString(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function setString(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    /* ignore */
  }
}

export function getNumber(key: string, fallback = 0): number {
  const v = getString(key);
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function setNumber(key: string, value: number): void {
  setString(key, String(value));
}

export function getJSON<T>(key: string, fallback: T): T {
  const raw = getString(key);
  if (raw === null) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

export function setJSON<T>(key: string, value: T): void {
  setString(key, JSON.stringify(value));
}
