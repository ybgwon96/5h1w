// Visual themes. Each theme supplies an 8-colour block palette plus the
// background, panel and accent colours used across the canvas and DOM UI.
export interface Theme {
  id: string;
  nameKo: string;
  nameEn: string;
  bgTop: string;
  bgBottom: string;
  panel: string;
  accent: string;
  accent2: string;
  danger: string;
  text: string;
  palette: [string, string][];
}

export const THEMES: Record<string, Theme> = {
  neon: {
    id: "neon",
    nameKo: "네온",
    nameEn: "Neon",
    bgTop: "#0a0b1e",
    bgBottom: "#05060f",
    panel: "rgba(255,255,255,0.06)",
    accent: "#00f0ff",
    accent2: "#ff2bd6",
    danger: "#ff5d6c",
    text: "#ffffff",
    palette: [
      ["#00f0ff", "#0090ff"],
      ["#ff2bd6", "#a01aff"],
      ["#7cf73a", "#16a766"],
      ["#ffd23f", "#ff8a00"],
      ["#ff5d6c", "#d61a3c"],
      ["#5b8cff", "#653e9b"],
      ["#36f1cd", "#0bb39a"],
      ["#ff9f1c", "#ff5400"],
    ],
  },
  candy: {
    id: "candy",
    nameKo: "캔디",
    nameEn: "Candy",
    bgTop: "#241433",
    bgBottom: "#140a22",
    panel: "rgba(255,255,255,0.08)",
    accent: "#ff8fd0",
    accent2: "#7ee8fa",
    danger: "#ff6b8a",
    text: "#fff4fb",
    palette: [
      ["#ff9ec7", "#ff5fa2"],
      ["#a78bfa", "#7c3aed"],
      ["#7ee8fa", "#38bdf8"],
      ["#ffe08a", "#fbbf24"],
      ["#ff8a8a", "#ef4444"],
      ["#9ae6b4", "#34d399"],
      ["#fdba74", "#fb923c"],
      ["#c4b5fd", "#8b5cf6"],
    ],
  },
  mono: {
    id: "mono",
    nameKo: "모노",
    nameEn: "Mono",
    bgTop: "#15181d",
    bgBottom: "#0a0c0f",
    panel: "rgba(255,255,255,0.05)",
    accent: "#e7eef5",
    accent2: "#8ab4f8",
    danger: "#f28b82",
    text: "#f5f7fa",
    palette: [
      ["#e7eef5", "#aab4bf"],
      ["#cfd8e3", "#9aa4b0"],
      ["#b8c2cf", "#828c98"],
      ["#a3aebb", "#6f7884"],
      ["#8ab4f8", "#5e81c4"],
      ["#dfe6ee", "#b3bcc6"],
      ["#c2ccd6", "#8e97a2"],
      ["#9fb3c8", "#71808f"],
    ],
  },
};

export const THEME_IDS = Object.keys(THEMES);

export function getTheme(id: string): Theme {
  return THEMES[id] ?? THEMES.neon;
}
