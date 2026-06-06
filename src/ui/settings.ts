import { getJSON, setJSON } from "./storage";
import { THEMES } from "./themes";

export type Lang = "ko" | "en";

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  theme: string;
  lang: Lang;
  reducedMotion: boolean;
}

function detectLang(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith("ko") ? "ko" : "en";
  } catch {
    return "en";
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

const KEY = "settings";

export function defaultSettings(): Settings {
  return {
    sound: true,
    music: true,
    haptics: true,
    theme: "neon",
    lang: detectLang(),
    reducedMotion: prefersReducedMotion(),
  };
}

export function loadSettings(): Settings {
  const s = getJSON<Settings>(KEY, defaultSettings());
  if (!THEMES[s.theme]) s.theme = "neon";
  if (s.lang !== "ko" && s.lang !== "en") s.lang = detectLang();
  return s;
}

export function saveSettings(s: Settings): void {
  setJSON(KEY, s);
}
