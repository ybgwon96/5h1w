import type { Lang } from "./settings";

type Dict = Record<string, string>;

const STRINGS: Record<Lang, Dict> = {
  ko: {
    title: "BLOCK BLAST",
    tagline: "네온 블록 퍼즐",
    play: "클래식 플레이",
    daily: "오늘의 챌린지",
    settings: "설정",
    help: "게임 방법",
    back: "뒤로",
    resume: "계속하기",
    restart: "다시 시작",
    home: "홈",
    revive: "부활 (1회)",
    best: "최고",
    score: "점수",
    level: "레벨",
    lines: "줄",
    maxCombo: "최대 콤보",
    gamesPlayed: "플레이 횟수",
    gameOver: "게임 오버",
    newRecord: "★ 신기록!",
    tapToStart: "탭하여 시작",
    dragHint: "블록을 드래그해서 줄을 채우세요",
    sound: "효과음",
    music: "배경음악",
    haptics: "진동",
    theme: "테마",
    language: "언어",
    reducedMotion: "모션 줄이기",
    on: "켜짐",
    off: "꺼짐",
    paused: "일시정지",
    helpBody:
      "8×8 보드에 블록 3개를 드래그해서 놓으세요. 가로 또는 세로 한 줄이 가득 차면 사라지고 점수를 얻습니다. 한 번에 여러 줄을 지우면 콤보 배수, 연속으로 지우면 연속 보너스가 붙습니다. 더 놓을 곳이 없으면 게임 오버!",
    privacy: "개인정보 처리방침",
    privacyBody:
      "이 게임은 어떤 개인정보도 수집·전송하지 않습니다. 최고 점수와 설정은 기기 안(localStorage)에만 저장됩니다.",
    dailyToday: "오늘의 시드",
    statsTitle: "통계",
  },
  en: {
    title: "BLOCK BLAST",
    tagline: "Neon Block Puzzle",
    play: "Play Classic",
    daily: "Daily Challenge",
    settings: "Settings",
    help: "How to Play",
    back: "Back",
    resume: "Resume",
    restart: "Restart",
    home: "Home",
    revive: "Revive (1×)",
    best: "Best",
    score: "Score",
    level: "Level",
    lines: "Lines",
    maxCombo: "Max Combo",
    gamesPlayed: "Games",
    gameOver: "Game Over",
    newRecord: "★ New Record!",
    tapToStart: "Tap to start",
    dragHint: "Drag blocks to clear lines",
    sound: "Sound FX",
    music: "Music",
    haptics: "Haptics",
    theme: "Theme",
    language: "Language",
    reducedMotion: "Reduced motion",
    on: "On",
    off: "Off",
    paused: "Paused",
    helpBody:
      "Drag the three blocks onto the 8×8 board. Fill a full row or column to clear it and score. Clear several lines at once for a combo multiplier, or clear on back-to-back moves for a streak bonus. When nothing fits, it's game over!",
    privacy: "Privacy Policy",
    privacyBody:
      "This game collects and transmits no personal data whatsoever. Your high score and settings are stored only on your device (localStorage).",
    dailyToday: "Today's seed",
    statsTitle: "Stats",
  },
};

export class I18n {
  private lang: Lang;
  constructor(lang: Lang) {
    this.lang = lang;
  }
  setLang(lang: Lang): void {
    this.lang = lang;
  }
  get(key: string): string {
    return STRINGS[this.lang][key] ?? STRINGS.en[key] ?? key;
  }
}
