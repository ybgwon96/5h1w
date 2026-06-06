import {
  dailyKey,
  GameEngine,
  type GameEvent,
  GRID,
  type Mode,
  type Piece,
  seedFromString,
} from "./core";
import { Particles } from "./particles";
import { audio } from "./ui/audio";
import { clear as clearNode, h } from "./ui/dom";
import { I18n } from "./ui/i18n";
import { loadSettings, type Lang, saveSettings, type Settings } from "./ui/settings";
import { loadStats, recordRun, type Stats } from "./ui/stats";
import { getTheme, type Theme, THEME_IDS } from "./ui/themes";

type Screen = "title" | "playing" | "gameover";

interface Drag {
  slot: number;
  piece: Piece;
  px: number;
  py: number;
}
interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  vy: number;
  size: number;
}

const TUTORIAL_KEY = "block-blast:seen";

export class App {
  private ctx: CanvasRenderingContext2D;
  private overlay: HTMLElement;
  private w = 0;
  private h = 0;

  private engine = new GameEngine(8);
  private settings: Settings = loadSettings();
  private i18n = new I18n(this.settings.lang);
  private theme: Theme = getTheme(this.settings.theme);
  private stats: Stats = loadStats();

  private screen: Screen = "title";
  private paused = false;
  private mode: Mode = "classic";
  private drag: Drag | null = null;

  // view animation state
  private particles = new Particles();
  private popups: Popup[] = [];
  private clearing: { x: number; y: number; color: number; life: number }[] = [];
  private popTime = new Array(GRID * GRID).fill(0);
  private invalidFx: { x: number; y: number; life: number } | null = null;
  private shake = 0;
  private flash = 0;
  private pulse = 0;
  private deadTimer = 0;
  private placeAnim = 0;
  private shownScore = 0;
  private newRecord = false;
  private showTutorial = false;

  // layout
  private cs = 0;
  private bx = 0;
  private by = 0;
  private boardSize = 0;
  private trayTop = 0;
  private trayH = 0;
  private trayCS = 0;
  private btnMute = { x: 0, y: 0, r: 0 };
  private btnPause = { x: 0, y: 0, r: 0 };

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.overlay = overlay;
    audio.setSound(this.settings.sound);
    audio.setMusic(this.settings.music);
    this.applyTheme();
    this.showTitle();
  }

  private get reduced(): boolean {
    return this.settings.reducedMotion;
  }

  // ---- layout ------------------------------------------------------------

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    const hudH = h * 0.15;
    this.boardSize = Math.min(w * 0.94, h * 0.6);
    this.cs = this.boardSize / GRID;
    this.bx = (w - this.boardSize) / 2;
    this.by = hudH;
    this.trayTop = this.by + this.boardSize + h * 0.025;
    this.trayH = Math.max(h * 0.16, h - this.trayTop - h * 0.02);
    this.trayCS = Math.min(this.cs * 0.5, w / 3 / 5.5, this.trayH / 4.5);
    const r = Math.min(w, h) * 0.052;
    const m = r + w * 0.04;
    this.btnMute = { x: m, y: h * 0.05, r };
    this.btnPause = { x: w - m, y: h * 0.05, r };
  }

  // ---- input -------------------------------------------------------------

  pointerDown(x: number, y: number): void {
    audio.resume();
    if (this.screen !== "playing" || this.paused) return;

    if (this.hit(this.btnMute, x, y)) {
      this.settings.sound = !this.settings.sound;
      audio.setSound(this.settings.sound);
      saveSettings(this.settings);
      audio.ui();
      return;
    }
    if (this.hit(this.btnPause, x, y)) {
      audio.ui();
      this.openSettings(true);
      return;
    }

    for (let i = 0; i < this.engine.tray.length; i++) {
      const piece = this.engine.tray[i];
      if (!piece) continue;
      const c = this.traySlot(i);
      const pw = piece.w * this.trayCS;
      const ph = piece.h * this.trayCS;
      const left = c.x - pw / 2;
      const top = c.y - ph / 2;
      const pad = this.trayCS * 0.8;
      if (x >= left - pad && x <= left + pw + pad && y >= top - pad && y <= top + ph + pad) {
        this.drag = { slot: i, piece, px: x, py: y };
        audio.pick();
        return;
      }
    }
  }

  pointerMove(x: number, y: number): void {
    if (this.drag) {
      this.drag.px = x;
      this.drag.py = y;
    }
  }

  pointerUp(): void {
    if (!this.drag) return;
    const t = this.snap(this.drag);
    if (t && this.engine.fits(this.drag.piece, t.gx, t.gy)) {
      const res = this.engine.tryPlace(this.drag.slot, t.gx, t.gy);
      if (res.ok) {
        this.placeAnim = 1;
        if (this.showTutorial) {
          this.showTutorial = false;
          try {
            localStorage.setItem(TUTORIAL_KEY, "1");
          } catch {
            /* ignore */
          }
        }
        this.onEvents(res.events);
      }
    } else {
      this.invalidFx = { x: this.drag.px, y: this.drag.py, life: 0.3 };
      audio.invalid();
      this.haptic(20);
    }
    this.drag = null;
  }

  private hit(b: { x: number; y: number; r: number }, x: number, y: number): boolean {
    const dx = x - b.x;
    const dy = y - b.y;
    return dx * dx + dy * dy <= b.r * b.r * 1.6;
  }

  private snap(d: Drag): { gx: number; gy: number } {
    const pw = d.piece.w * this.cs;
    const ph = d.piece.h * this.cs;
    const lift = this.cs * 1.2;
    const gx = Math.round((d.px - pw / 2 - this.bx) / this.cs);
    const gy = Math.round((d.py - ph - lift - this.by) / this.cs);
    return { gx, gy };
  }

  private traySlot(i: number): { x: number; y: number } {
    const slotW = this.w / 3;
    return { x: slotW * i + slotW / 2, y: this.trayTop + this.trayH / 2 };
  }

  private haptic(pattern: number | number[]): void {
    if (!this.settings.haptics) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* ignore */
    }
  }

  // ---- game flow ---------------------------------------------------------

  private startGame(mode: Mode): void {
    this.mode = mode;
    const seed = mode === "daily" ? seedFromString(dailyKey()) : undefined;
    this.engine.newGame(mode, seed);
    this.screen = "playing";
    this.paused = false;
    this.newRecord = false;
    this.shownScore = 0;
    this.popups = [];
    this.clearing = [];
    this.popTime.fill(0);
    this.invalidFx = null;
    this.particles.clear();
    try {
      this.showTutorial = localStorage.getItem(TUTORIAL_KEY) !== "1";
    } catch {
      this.showTutorial = false;
    }
    audio.resume();
    audio.start();
    this.hideOverlay();
  }

  private onEvents(events: GameEvent[]): void {
    for (const e of events) {
      if (e.type === "place") {
        for (const idx of e.cells) this.popTime[idx] = 0.22;
        audio.place();
        this.haptic(8);
      } else if (e.type === "clear") {
        this.spawnClear(e.cells, e.colors);
        this.popups.push({
          x: this.bx + this.boardSize / 2,
          y: this.by + this.boardSize / 2,
          text: `+${e.gained}`,
          color: this.theme.text,
          life: 0.9,
          max: 0.9,
          vy: -this.cs * 1.2,
          size: this.cs * 0.9,
        });
        const label =
          e.lines >= 4
            ? "INCREDIBLE!"
            : e.lines === 3
              ? "TRIPLE!"
              : e.lines === 2
                ? "DOUBLE!"
                : e.streak >= 2
                  ? `STREAK x${e.streak}`
                  : "";
        if (label) {
          this.popups.push({
            x: this.bx + this.boardSize / 2,
            y: this.by + this.boardSize / 2 - this.cs * 1.1,
            text: label,
            color: this.theme.accent2,
            life: 1.1,
            max: 1.1,
            vy: -this.cs * 0.8,
            size: this.cs * 0.75,
          });
        }
        if (!this.reduced) {
          this.shake = Math.min(18, 6 + e.lines * 4);
          this.flash = Math.min(0.5, 0.15 + e.lines * 0.1);
        }
        audio.clear(e.lines + e.streak);
        this.haptic(e.lines >= 2 ? [20, 20, 30] : 16);
      } else if (e.type === "levelup") {
        if (!this.reduced) this.flash = Math.max(this.flash, 0.4);
        audio.levelUp();
        this.haptic([15, 25, 15]);
        this.popups.push({
          x: this.w / 2,
          y: this.by - this.cs * 0.2,
          text: `LEVEL ${e.level}`,
          color: this.theme.accent,
          life: 1.3,
          max: 1.3,
          vy: -this.cs * 0.5,
          size: this.cs * 0.85,
        });
      } else if (e.type === "gameover") {
        this.onGameOver(e.score);
      }
    }
  }

  private spawnClear(cells: number[], colors: number[]): void {
    for (let k = 0; k < cells.length; k++) {
      const idx = cells[k];
      const color = colors[k] ?? 0;
      const x = idx % GRID;
      const y = (idx / GRID) | 0;
      const cx = this.bx + x * this.cs + this.cs / 2;
      const cy = this.by + y * this.cs + this.cs / 2;
      this.clearing.push({ x: cx, y: cy, color, life: 0.35 });
      if (!this.reduced) {
        this.particles.burst(cx, cy, 8, this.theme.palette[color]?.[0] ?? "#fff", {
          speed: 240,
          size: this.cs * 0.12,
          life: 0.6,
        });
      }
    }
  }

  private onGameOver(score: number): void {
    this.deadTimer = 0;
    if (!this.reduced) {
      this.shake = 16;
      this.flash = 0.5;
    }
    audio.over();
    this.haptic([40, 40, 80]);
    const { stats, newBest } = recordRun({
      score,
      lines: this.engine.linesTotal,
      combo: this.engine.maxCombo,
      level: this.engine.level,
    });
    this.stats = stats;
    this.newRecord = newBest;
    this.screen = "gameover";
    // Brief delay before the overlay so the death FX is visible.
    setTimeout(() => {
      if (this.screen === "gameover") this.showGameOver();
    }, 650);
  }

  // ---- update / render ---------------------------------------------------

  update(dt: number): void {
    this.pulse += dt;
    this.particles.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 50);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.4);
    if (this.placeAnim > 0) this.placeAnim = Math.max(0, this.placeAnim - dt * 4);
    if (this.screen === "gameover") this.deadTimer += dt;

    for (let i = 0; i < this.popTime.length; i++) {
      if (this.popTime[i] > 0) this.popTime[i] = Math.max(0, this.popTime[i] - dt);
    }
    if (this.invalidFx) {
      this.invalidFx.life -= dt;
      if (this.invalidFx.life <= 0) this.invalidFx = null;
    }
    const target = Math.floor(this.engine.score);
    if (this.shownScore < target) {
      this.shownScore = Math.min(
        target,
        this.shownScore + Math.ceil((target - this.shownScore) * 0.25) + 1
      );
    } else {
      this.shownScore = target;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.clearing.length - 1; i >= 0; i--) {
      this.clearing[i].life -= dt;
      if (this.clearing[i].life <= 0) this.clearing.splice(i, 1);
    }
  }

  render(): void {
    const ctx = this.ctx;
    this.drawBackground();

    ctx.save();
    if (this.shake > 0 && !this.reduced) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    this.drawBoard();
    this.drawClearing();
    this.particles.draw(ctx);
    ctx.restore();

    if (this.screen === "playing") {
      this.drawTray();
      this.drawDrag();
      this.drawInvalid();
      this.drawPopups();
      this.drawHud();
      this.drawButtons();
      if (this.showTutorial && !this.paused) this.drawTutorial();
    } else {
      this.drawPopups();
    }

    if (this.flash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.4})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, this.theme.bgTop);
    g.addColorStop(1, this.theme.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawBoard(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.theme.panel;
    roundRect(ctx, this.bx - 6, this.by - 6, this.boardSize + 12, this.boardSize + 12, 16);
    ctx.fill();
    ctx.restore();

    const board = this.engine.board;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const i = y * GRID + x;
        const px = this.bx + x * this.cs;
        const py = this.by + y * this.cs;
        const v = board[i];
        if (v === 0) {
          ctx.save();
          ctx.fillStyle = (x + y) % 2 === 0 ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.03)";
          roundRect(ctx, px + 1.5, py + 1.5, this.cs - 3, this.cs - 3, this.cs * 0.18);
          ctx.fill();
          ctx.restore();
        } else {
          const pop = this.popTime[i];
          if (pop > 0 && !this.reduced) {
            const t = pop / 0.22;
            const s = 1 + t * 0.18;
            const off = (this.cs * (s - 1)) / 2;
            this.drawBlock(px - off, py - off, this.cs * s, v - 1, 1);
          } else {
            this.drawBlock(px, py, this.cs, v - 1, 1);
          }
        }
      }
    }

    if (this.drag) {
      const t = this.snap(this.drag);
      if (this.engine.fits(this.drag.piece, t.gx, t.gy)) {
        this.highlight(this.drag.piece, t.gx, t.gy);
        for (const [ox, oy] of this.drag.piece.cells) {
          this.drawBlock(
            this.bx + (t.gx + ox) * this.cs,
            this.by + (t.gy + oy) * this.cs,
            this.cs,
            this.drag.piece.color,
            0.45
          );
        }
      }
    }
  }

  private highlight(piece: Piece, gx: number, gy: number): void {
    const board = this.engine.board;
    const temp = new Set<number>();
    for (const [ox, oy] of piece.cells) temp.add((gy + oy) * GRID + (gx + ox));
    const filled = (x: number, y: number) => board[y * GRID + x] !== 0 || temp.has(y * GRID + x);
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = hexToRgba(this.theme.accent, 0.12);
    for (let y = 0; y < GRID; y++) {
      let full = true;
      for (let x = 0; x < GRID; x++) if (!filled(x, y)) full = false;
      if (full) ctx.fillRect(this.bx, this.by + y * this.cs, this.boardSize, this.cs);
    }
    for (let x = 0; x < GRID; x++) {
      let full = true;
      for (let y = 0; y < GRID; y++) if (!filled(x, y)) full = false;
      if (full) ctx.fillRect(this.bx + x * this.cs, this.by, this.cs, this.boardSize);
    }
    ctx.restore();
  }

  private drawClearing(): void {
    const ctx = this.ctx;
    for (const c of this.clearing) {
      const a = c.life / 0.35;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = "lighter";
      const s = this.cs * (1 + (1 - a) * 0.6);
      this.drawBlock(c.x - s / 2, c.y - s / 2, s, c.color, a);
      ctx.restore();
    }
  }

  private drawBlock(px: number, py: number, size: number, color: number, alpha: number): void {
    const ctx = this.ctx;
    const [light, dark] = this.theme.palette[color] ?? ["#fff", "#aaa"];
    ctx.save();
    ctx.globalAlpha = alpha;
    if (!this.reduced) {
      ctx.shadowBlur = size * 0.35;
      ctx.shadowColor = light;
    }
    const g = ctx.createLinearGradient(px, py, px + size, py + size);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    roundRect(ctx, px + 1.5, py + 1.5, size - 3, size - 3, size * 0.2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    roundRect(ctx, px + size * 0.16, py + size * 0.14, size * 0.68, size * 0.2, size * 0.1);
    ctx.fill();
    ctx.restore();
  }

  private drawTray(): void {
    for (let i = 0; i < this.engine.tray.length; i++) {
      const piece = this.engine.tray[i];
      if (!piece || (this.drag && this.drag.slot === i)) continue;
      const c = this.traySlot(i);
      const left = c.x - (piece.w * this.trayCS) / 2;
      const top = c.y - (piece.h * this.trayCS) / 2;
      const bob = this.reduced ? 0 : Math.sin(this.pulse * 2 + i) * this.trayCS * 0.06;
      for (const [ox, oy] of piece.cells) {
        this.drawBlock(
          left + ox * this.trayCS,
          top + oy * this.trayCS + bob,
          this.trayCS,
          piece.color,
          1
        );
      }
    }
  }

  private drawDrag(): void {
    if (!this.drag) return;
    const d = this.drag;
    const left = d.px - (d.piece.w * this.cs) / 2;
    const top = d.py - d.piece.h * this.cs - this.cs * 1.2;
    for (const [ox, oy] of d.piece.cells) {
      this.drawBlock(left + ox * this.cs, top + oy * this.cs, this.cs, d.piece.color, 0.92);
    }
  }

  private drawInvalid(): void {
    if (!this.invalidFx) return;
    const ctx = this.ctx;
    const a = this.invalidFx.life / 0.3;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = this.theme.danger;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 14;
    ctx.shadowColor = this.theme.danger;
    ctx.beginPath();
    ctx.arc(this.invalidFx.x, this.invalidFx.y, this.cs * (0.5 + (1 - a) * 0.4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawPopups(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of this.popups) {
      const a = Math.min(1, p.life / (p.max * 0.5));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 16;
      ctx.shadowColor = p.color;
      ctx.font = `900 ${Math.round(p.size)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  }

  private drawHud(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `700 ${Math.round(this.h * 0.018)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(`${this.i18n.get("best")}  ${this.stats.bestScore}`, this.w / 2, this.h * 0.028);

    const pop = this.placeAnim > 0 && !this.reduced ? 1 + this.placeAnim * 0.06 : 1;
    ctx.fillStyle = this.theme.text;
    ctx.shadowBlur = 18;
    ctx.shadowColor = this.theme.accent;
    ctx.font = `900 ${Math.round(this.h * 0.058 * pop)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(String(this.shownScore), this.w / 2, this.h * 0.052);

    ctx.shadowBlur = 0;
    ctx.fillStyle = this.theme.accent;
    ctx.font = `800 ${Math.round(this.h * 0.02)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(
      `LV ${this.engine.level}  ·  x${this.engine.multiplier().toFixed(1)}`,
      this.w / 2,
      this.h * 0.108
    );

    if (this.engine.streak >= 2) {
      ctx.fillStyle = this.theme.accent2;
      ctx.shadowColor = this.theme.accent2;
      ctx.shadowBlur = 12;
      ctx.font = `800 ${Math.round(this.h * 0.022)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(`🔥 x${this.engine.streak}`, this.w / 2, this.h * 0.128);
    }
    ctx.restore();
  }

  private drawButtons(): void {
    this.drawBtnBase(this.btnMute);
    this.drawSpeaker(this.btnMute, !this.settings.sound);
    this.drawBtnBase(this.btnPause);
    this.drawGear(this.btnPause);
  }

  private drawBtnBase(b: { x: number; y: number; r: number }): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawSpeaker(b: { x: number; y: number; r: number }, muted: boolean): void {
    const ctx = this.ctx;
    const s = b.r * 0.5;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = muted ? this.theme.danger : this.theme.text;
    ctx.strokeStyle = muted ? this.theme.danger : this.theme.text;
    ctx.lineWidth = b.r * 0.12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.9, -s * 0.35);
    ctx.lineTo(-s * 0.3, -s * 0.35);
    ctx.lineTo(s * 0.2, -s * 0.8);
    ctx.lineTo(s * 0.2, s * 0.8);
    ctx.lineTo(-s * 0.3, s * 0.35);
    ctx.lineTo(-s * 0.9, s * 0.35);
    ctx.closePath();
    ctx.fill();
    if (muted) {
      ctx.beginPath();
      ctx.moveTo(s * 0.5, -s * 0.5);
      ctx.lineTo(s * 1.0, s * 0.5);
      ctx.moveTo(s * 1.0, -s * 0.5);
      ctx.lineTo(s * 0.5, s * 0.5);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(s * 0.25, 0, s * 0.55, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGear(b: { x: number; y: number; r: number }): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = this.theme.text;
    const teeth = 8;
    const ro = b.r * 0.55;
    const ri = b.r * 0.33;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const ang = (i / (teeth * 2)) * Math.PI * 2;
      const rad = i % 2 === 0 ? ro : ro * 0.78;
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(0, 0, ri, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawTutorial(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(this.pulse * 3) * 0.45;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = this.theme.text;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.theme.accent;
    ctx.font = `700 ${Math.round(this.h * 0.024)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(this.i18n.get("dragHint"), this.w / 2, this.trayTop - this.h * 0.02);
    ctx.restore();
  }

  // ---- theme / overlays --------------------------------------------------

  private applyTheme(): void {
    this.theme = getTheme(this.settings.theme);
    const root = document.documentElement.style;
    root.setProperty("--bg", this.theme.bgBottom);
    root.setProperty("--panel", "rgba(255,255,255,0.08)");
    root.setProperty("--accent", this.theme.accent);
    root.setProperty("--accent2", this.theme.accent2);
    root.setProperty("--text", this.theme.text);
    root.setProperty("--danger", this.theme.danger);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", this.theme.bgBottom);
  }

  private hideOverlay(): void {
    this.overlay.style.display = "none";
    clearNode(this.overlay);
  }

  private panel(...children: (Node | string)[]): HTMLElement {
    this.overlay.style.display = "flex";
    clearNode(this.overlay);
    const card = h("div", { class: "card" }, ...children);
    this.overlay.appendChild(card);
    return card;
  }

  private button(label: string, onClick: () => void, kind = "primary"): HTMLElement {
    return h(
      "button",
      {
        class: `btn ${kind}`,
        type: "button",
        onclick: () => {
          audio.resume();
          audio.ui();
          onClick();
        },
      },
      label
    );
  }

  showTitle(): void {
    this.screen = "title";
    this.stats = loadStats();
    const t = this.i18n;
    this.panel(
      h("h1", { class: "logo" }, t.get("title")),
      h("p", { class: "tagline" }, t.get("tagline")),
      h("p", { class: "best" }, `${t.get("best")}: ${this.stats.bestScore}`),
      this.button(t.get("play"), () => this.startGame("classic")),
      this.button(t.get("daily"), () => this.startGame("daily"), "secondary"),
      this.button(t.get("settings"), () => this.openSettings(false), "secondary"),
      this.button(t.get("help"), () => this.showHelp(), "ghost")
    );
  }

  private openSettings(fromGame: boolean): void {
    this.paused = fromGame;
    const t = this.i18n;
    const rows: Node[] = [
      this.toggleRow(t.get("sound"), this.settings.sound, (v) => {
        this.settings.sound = v;
        audio.setSound(v);
        this.commitSettings();
      }),
      this.toggleRow(t.get("music"), this.settings.music, (v) => {
        this.settings.music = v;
        audio.setMusic(v);
        this.commitSettings();
      }),
      this.toggleRow(t.get("haptics"), this.settings.haptics, (v) => {
        this.settings.haptics = v;
        this.commitSettings();
      }),
      this.toggleRow(t.get("reducedMotion"), this.settings.reducedMotion, (v) => {
        this.settings.reducedMotion = v;
        this.commitSettings();
      }),
      this.choiceRow(
        t.get("theme"),
        THEME_IDS.map((id) => ({
          id,
          label: this.settings.lang === "ko" ? getTheme(id).nameKo : getTheme(id).nameEn,
        })),
        this.settings.theme,
        (id) => {
          this.settings.theme = id;
          this.applyTheme();
          this.commitSettings();
          this.openSettings(fromGame);
        }
      ),
      this.choiceRow(
        t.get("language"),
        [
          { id: "ko", label: "한국어" },
          { id: "en", label: "English" },
        ],
        this.settings.lang,
        (id) => {
          this.settings.lang = id as Lang;
          this.i18n.setLang(this.settings.lang);
          this.commitSettings();
          this.openSettings(fromGame);
        }
      ),
    ];

    const actions: Node[] = [];
    if (fromGame) {
      actions.push(this.button(t.get("resume"), () => this.resumeGame()));
      actions.push(this.button(t.get("restart"), () => this.startGame(this.mode), "secondary"));
      actions.push(this.button(t.get("home"), () => this.showTitle(), "ghost"));
    } else {
      actions.push(this.button(t.get("back"), () => this.showTitle()));
    }

    this.panel(
      h("h2", {}, fromGame ? t.get("paused") : t.get("settings")),
      h("div", { class: "rows" }, ...rows),
      h("div", { class: "actions" }, ...actions)
    );
  }

  private resumeGame(): void {
    this.paused = false;
    this.hideOverlay();
  }

  private showHelp(): void {
    const t = this.i18n;
    this.panel(
      h("h2", {}, t.get("help")),
      h("p", { class: "body" }, t.get("helpBody")),
      h("h3", {}, t.get("privacy")),
      h("p", { class: "body small" }, t.get("privacyBody")),
      h(
        "div",
        { class: "actions" },
        this.button(t.get("back"), () => this.showTitle())
      )
    );
  }

  private showGameOver(): void {
    const t = this.i18n;
    const e = this.engine;
    const actions: Node[] = [];
    if (e.canOfferRevive()) {
      actions.push(
        this.button(t.get("revive"), () => {
          if (e.revive()) {
            this.screen = "playing";
            this.paused = false;
            this.hideOverlay();
          }
        })
      );
    }
    actions.push(this.button(t.get("restart"), () => this.startGame(this.mode), "secondary"));
    actions.push(this.button(t.get("home"), () => this.showTitle(), "ghost"));

    this.panel(
      h("h2", { class: "over" }, t.get("gameOver")),
      h("div", { class: "finalScore" }, String(Math.floor(e.score))),
      this.newRecord
        ? h("p", { class: "record" }, t.get("newRecord"))
        : h("p", { class: "best" }, `${t.get("best")}: ${this.stats.bestScore}`),
      h(
        "div",
        { class: "statgrid" },
        this.stat(t.get("level"), String(e.level)),
        this.stat(t.get("lines"), String(e.linesTotal)),
        this.stat(t.get("maxCombo"), `x${e.maxCombo}`),
        this.stat(t.get("gamesPlayed"), String(this.stats.games))
      ),
      h("div", { class: "actions" }, ...actions)
    );
  }

  private stat(label: string, value: string): HTMLElement {
    return h(
      "div",
      { class: "stat" },
      h("span", { class: "v" }, value),
      h("span", { class: "k" }, label)
    );
  }

  private toggleRow(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
    const t = this.i18n;
    const btn = h(
      "button",
      {
        class: `toggle ${value ? "on" : "off"}`,
        type: "button",
        onclick: () => {
          const nv = !btn.classList.contains("on");
          btn.classList.toggle("on", nv);
          btn.classList.toggle("off", !nv);
          btn.textContent = nv ? t.get("on") : t.get("off");
          audio.ui();
          onChange(nv);
        },
      },
      value ? t.get("on") : t.get("off")
    );
    return h("div", { class: "row" }, h("span", {}, label), btn);
  }

  private choiceRow(
    label: string,
    options: { id: string; label: string }[],
    current: string,
    onChange: (id: string) => void
  ): HTMLElement {
    const seg = h(
      "div",
      { class: "seg" },
      ...options.map((o) =>
        h(
          "button",
          {
            class: `segbtn ${o.id === current ? "active" : ""}`,
            type: "button",
            onclick: () => {
              audio.ui();
              onChange(o.id);
            },
          },
          o.label
        )
      )
    );
    return h("div", { class: "row" }, h("span", {}, label), seg);
  }

  private commitSettings(): void {
    saveSettings(this.settings);
  }
}

// ---- helpers ------------------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hexToRgba(hex: string, a: number): string {
  const v = hex.replace("#", "");
  if (v.length < 6) return `rgba(0,240,255,${a})`;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
