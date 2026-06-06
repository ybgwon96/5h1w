import { audio } from "./audio";
import { Particles } from "./particles";
import {
  getBest,
  setBest,
  getBestCombo,
  setBestCombo,
  hasSeenTutorial,
  markTutorialSeen,
} from "./storage";

type State = "playing" | "dead";
type Coord = [number, number];

const GRID = 8;
const LINES_PER_LEVEL = 8;

// Neon block palette: [light, dark] gradient stops. Index 0 in the board
// means "empty"; stored cells hold paletteIndex + 1.
const PALETTE: [string, string][] = [
  ["#00f0ff", "#0090ff"],
  ["#ff2bd6", "#a01aff"],
  ["#7cf73a", "#16a766"],
  ["#ffd23f", "#ff8a00"],
  ["#ff5d6c", "#d61a3c"],
  ["#5b8cff", "#653e9b"],
  ["#36f1cd", "#0bb39a"],
  ["#ff9f1c", "#ff5400"],
];

// Background top-gradient accent per level (cycles). Gives a sense of
// progression as the player climbs levels.
const LEVEL_ACCENTS = ["#0a0b1e", "#0a141e", "#140a1e", "#1e0a16", "#0a1e16", "#1e160a"];

// Base polyomino shapes (cell offsets). Rotations are generated at runtime.
const BASE_SHAPES: Coord[][] = [
  [[0, 0]],
  [
    [0, 0],
    [1, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
];

interface Piece {
  cells: Coord[];
  color: number; // palette index
  w: number;
  h: number;
}

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

interface Button {
  x: number;
  y: number;
  r: number;
}

function normalize(cells: Coord[]): Coord[] {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY] as Coord);
}

function rotate(cells: Coord[]): Coord[] {
  return normalize(cells.map(([x, y]) => [-y, x] as Coord));
}

function key(cells: Coord[]): string {
  return [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]).join("|");
}

function rotations(base: Coord[]): Coord[][] {
  const out: Coord[][] = [];
  const seen = new Set<string>();
  let cur = normalize(base);
  for (let i = 0; i < 4; i++) {
    const k = key(cur);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(cur);
    }
    cur = rotate(cur);
  }
  return out;
}

const SHAPE_ROTATIONS = BASE_SHAPES.map(rotations);

function makePiece(cells: Coord[], color: number): Piece {
  const w = Math.max(...cells.map((c) => c[0])) + 1;
  const h = Math.max(...cells.map((c) => c[1])) + 1;
  return { cells, color, w, h };
}

function randomPiece(): Piece {
  const rots = SHAPE_ROTATIONS[(Math.random() * SHAPE_ROTATIONS.length) | 0];
  const cells = rots[(Math.random() * rots.length) | 0];
  return makePiece(cells, (Math.random() * PALETTE.length) | 0);
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;

  private state: State = "playing";
  private board: number[] = new Array(GRID * GRID).fill(0);
  private tray: (Piece | null)[] = [];
  private drag: Drag | null = null;

  private score = 0;
  private best = getBest();
  private bestCombo = getBestCombo();
  private streak = 0;
  private maxCombo = 0;
  private linesTotal = 0;
  private level = 1;
  private shownScore = 0;

  private particles = new Particles();
  private popups: Popup[] = [];
  private clearing: { x: number; y: number; color: number; life: number }[] = [];
  private popTime: number[] = new Array(GRID * GRID).fill(0);
  private invalidFx: { x: number; y: number; life: number } | null = null;
  private shake = 0;
  private flash = 0;
  private pulse = 0;
  private deadTimer = 0;
  private newRecord = false;
  private placeAnim = 0;
  private accentMix = 0; // eases background toward new level accent
  private showTutorial = !hasSeenTutorial();

  // layout
  private cs = 0;
  private bx = 0;
  private by = 0;
  private boardSize = 0;
  private trayTop = 0;
  private trayH = 0;
  private trayCS = 0;
  private btnMute: Button = { x: 0, y: 0, r: 0 };
  private btnRestart: Button = { x: 0, y: 0, r: 0 };

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.generateTray();
  }

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
    this.btnRestart = { x: w - m, y: h * 0.05, r };
  }

  // ---- input -------------------------------------------------------------

  pointerDown(x: number, y: number): void {
    audio.resume();

    if (this.hitButton(this.btnMute, x, y)) {
      audio.toggleMute();
      audio.ui();
      return;
    }
    if (this.hitButton(this.btnRestart, x, y)) {
      audio.ui();
      this.restart();
      return;
    }

    if (this.state === "dead") {
      if (this.deadTimer > 0.45) this.restart();
      return;
    }

    for (let i = 0; i < this.tray.length; i++) {
      const piece = this.tray[i];
      if (!piece) continue;
      const c = this.traySlotCenter(i);
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
    const target = this.snappedCell(this.drag);
    if (target && this.fits(this.drag.piece, target.gx, target.gy)) {
      this.place(this.drag.slot, this.drag.piece, target.gx, target.gy);
    } else {
      this.invalidFx = { x: this.drag.px, y: this.drag.py, life: 0.3 };
      audio.invalid();
      vibrate(20);
    }
    this.drag = null;
  }

  private hitButton(b: Button, x: number, y: number): boolean {
    const dx = x - b.x;
    const dy = y - b.y;
    return dx * dx + dy * dy <= b.r * b.r * 1.6;
  }

  private snappedCell(d: Drag): { gx: number; gy: number } | null {
    const pw = d.piece.w * this.cs;
    const ph = d.piece.h * this.cs;
    const lift = this.cs * 1.2;
    const topLeftX = d.px - pw / 2;
    const topLeftY = d.py - ph - lift;
    const gx = Math.round((topLeftX - this.bx) / this.cs);
    const gy = Math.round((topLeftY - this.by) / this.cs);
    return { gx, gy };
  }

  // ---- game logic --------------------------------------------------------

  // Generate a fresh tray of 3 that is guaranteed to be playable: at least
  // one piece must fit somewhere on the current board (anti-frustration).
  private generateTray(): void {
    for (let attempt = 0; attempt < 40; attempt++) {
      const cand = [randomPiece(), randomPiece(), randomPiece()];
      if (cand.some((p) => this.canPlaceAnywhere(p))) {
        this.tray = cand;
        return;
      }
    }
    // Fallback: a single 1x1 always fits if any cell is empty.
    this.tray = [
      randomPiece(),
      randomPiece(),
      makePiece([[0, 0]], (Math.random() * PALETTE.length) | 0),
    ];
  }

  private fits(piece: Piece, gx: number, gy: number): boolean {
    for (const [ox, oy] of piece.cells) {
      const x = gx + ox;
      const y = gy + oy;
      if (x < 0 || x >= GRID || y < 0 || y >= GRID) return false;
      if (this.board[y * GRID + x] !== 0) return false;
    }
    return true;
  }

  private canPlaceAnywhere(piece: Piece): boolean {
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        if (this.fits(piece, gx, gy)) return true;
      }
    }
    return false;
  }

  private anyMoveLeft(): boolean {
    return this.tray.some((p) => p && this.canPlaceAnywhere(p));
  }

  private levelMultiplier(): number {
    return 1 + (this.level - 1) * 0.2;
  }

  private place(slot: number, piece: Piece, gx: number, gy: number): void {
    for (const [ox, oy] of piece.cells) {
      const idx = (gy + oy) * GRID + (gx + ox);
      this.board[idx] = piece.color + 1;
      this.popTime[idx] = 0.22;
    }
    this.score += piece.cells.length;
    this.tray[slot] = null;
    this.placeAnim = 1;
    audio.place();
    vibrate(8);

    if (this.showTutorial) {
      this.showTutorial = false;
      markTutorialSeen();
    }

    this.resolveClears();

    if (this.tray.every((p) => !p)) this.generateTray();

    if (!this.anyMoveLeft()) this.die();
  }

  private resolveClears(): void {
    const fullRows: number[] = [];
    const fullCols: number[] = [];
    for (let y = 0; y < GRID; y++) {
      let full = true;
      for (let x = 0; x < GRID; x++) if (this.board[y * GRID + x] === 0) full = false;
      if (full) fullRows.push(y);
    }
    for (let x = 0; x < GRID; x++) {
      let full = true;
      for (let y = 0; y < GRID; y++) if (this.board[y * GRID + x] === 0) full = false;
      if (full) fullCols.push(x);
    }
    const lines = fullRows.length + fullCols.length;
    if (lines === 0) {
      this.streak = 0;
      return;
    }

    const cleared = new Set<number>();
    for (const y of fullRows) for (let x = 0; x < GRID; x++) cleared.add(y * GRID + x);
    for (const x of fullCols) for (let y = 0; y < GRID; y++) cleared.add(y * GRID + x);

    for (const idx of cleared) {
      const x = idx % GRID;
      const y = (idx / GRID) | 0;
      const color = this.board[idx] - 1;
      const cx = this.bx + x * this.cs + this.cs / 2;
      const cy = this.by + y * this.cs + this.cs / 2;
      this.clearing.push({ x: cx, y: cy, color, life: 0.35 });
      this.particles.burst(cx, cy, 10, PALETTE[color]?.[0] ?? "#fff", {
        speed: 240,
        size: this.cs * 0.12,
        life: 0.6,
      });
      this.board[idx] = 0;
    }

    this.streak++;
    this.maxCombo = Math.max(this.maxCombo, this.streak);

    // Level progression on total lines cleared.
    this.linesTotal += lines;
    const newLevel = 1 + Math.floor(this.linesTotal / LINES_PER_LEVEL);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.onLevelUp();
    }

    const base = cleared.size * 10;
    const comboMult = lines;
    const streakBonus = (this.streak - 1) * 15;
    const gained = Math.round((base * comboMult + streakBonus) * this.levelMultiplier());
    this.score += gained;

    const center = { x: this.bx + this.boardSize / 2, y: this.by + this.boardSize / 2 };
    this.popups.push({
      x: center.x,
      y: center.y,
      text: `+${gained}`,
      color: "#ffffff",
      life: 0.9,
      max: 0.9,
      vy: -this.cs * 1.2,
      size: this.cs * 0.9,
    });
    const label =
      lines >= 4
        ? "INCREDIBLE!"
        : lines === 3
          ? "TRIPLE!"
          : lines === 2
            ? "DOUBLE!"
            : this.streak >= 2
              ? `STREAK x${this.streak}`
              : "";
    if (label) {
      this.popups.push({
        x: center.x,
        y: center.y - this.cs * 1.1,
        text: label,
        color: "#ff2bd6",
        life: 1.1,
        max: 1.1,
        vy: -this.cs * 0.8,
        size: this.cs * 0.75,
      });
    }
    this.shake = Math.min(18, 6 + lines * 4);
    this.flash = Math.min(0.5, 0.15 + lines * 0.1);
    audio.clear(lines + this.streak);
    vibrate(lines >= 2 ? [20, 20, 30] : 16);
  }

  private onLevelUp(): void {
    this.accentMix = 0;
    this.flash = Math.max(this.flash, 0.4);
    this.shake = Math.max(this.shake, 8);
    audio.levelUp();
    vibrate([15, 25, 15]);
    this.popups.push({
      x: this.w / 2,
      y: this.by - this.cs * 0.2,
      text: `LEVEL ${this.level}`,
      color: "#36f1cd",
      life: 1.3,
      max: 1.3,
      vy: -this.cs * 0.5,
      size: this.cs * 0.85,
    });
  }

  private die(): void {
    this.state = "dead";
    this.deadTimer = 0;
    this.shake = 16;
    this.flash = 0.5;
    audio.over();
    vibrate([40, 40, 80]);
    if (Math.floor(this.score) > this.best) {
      this.best = Math.floor(this.score);
      setBest(this.best);
      this.newRecord = true;
    }
    if (this.maxCombo > this.bestCombo) {
      this.bestCombo = this.maxCombo;
      setBestCombo(this.bestCombo);
    }
  }

  private restart(): void {
    this.board.fill(0);
    this.popTime.fill(0);
    this.score = 0;
    this.shownScore = 0;
    this.streak = 0;
    this.maxCombo = 0;
    this.linesTotal = 0;
    this.level = 1;
    this.newRecord = false;
    this.state = "playing";
    this.popups = [];
    this.clearing = [];
    this.invalidFx = null;
    this.particles.clear();
    this.generateTray();
    audio.start();
  }

  // ---- update / render ---------------------------------------------------

  update(dt: number): void {
    this.pulse += dt;
    this.particles.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 50);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.4);
    if (this.placeAnim > 0) this.placeAnim = Math.max(0, this.placeAnim - dt * 4);
    if (this.accentMix < 1) this.accentMix = Math.min(1, this.accentMix + dt * 1.2);
    if (this.state === "dead") this.deadTimer += dt;

    for (let i = 0; i < this.popTime.length; i++) {
      if (this.popTime[i] > 0) this.popTime[i] = Math.max(0, this.popTime[i] - dt);
    }
    if (this.invalidFx) {
      this.invalidFx.life -= dt;
      if (this.invalidFx.life <= 0) this.invalidFx = null;
    }

    const target = Math.floor(this.score);
    if (this.shownScore < target) {
      this.shownScore = Math.min(
        target,
        this.shownScore + Math.ceil((target - this.shownScore) * 0.2) + 1
      );
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
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    this.drawBoard();
    this.drawClearing();
    this.particles.draw(ctx);
    ctx.restore();

    this.drawTray();
    this.drawDrag();
    this.drawInvalid();
    this.drawPopups();
    this.drawHud();
    this.drawButtons();
    if (this.showTutorial && this.state === "playing") this.drawTutorial();

    if (this.flash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.4})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
    if (this.state === "dead") this.drawGameOver();
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    const accent = LEVEL_ACCENTS[(this.level - 1) % LEVEL_ACCENTS.length];
    const prev = LEVEL_ACCENTS[(this.level - 2 + LEVEL_ACCENTS.length) % LEVEL_ACCENTS.length];
    const top = this.level > 1 ? mix(prev, accent, this.accentMix) : accent;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, top);
    g.addColorStop(1, "#05060f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawBoard(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    roundRect(ctx, this.bx - 6, this.by - 6, this.boardSize + 12, this.boardSize + 12, 16);
    ctx.fill();
    ctx.restore();

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const idx = y * GRID + x;
        const px = this.bx + x * this.cs;
        const py = this.by + y * this.cs;
        const v = this.board[idx];
        if (v === 0) {
          ctx.save();
          ctx.fillStyle = (x + y) % 2 === 0 ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.03)";
          roundRect(ctx, px + 1.5, py + 1.5, this.cs - 3, this.cs - 3, this.cs * 0.18);
          ctx.fill();
          ctx.restore();
        } else {
          // Pop-in scale animation for freshly placed blocks.
          const pop = this.popTime[idx];
          if (pop > 0) {
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
      const t = this.snappedCell(this.drag);
      if (t && this.fits(this.drag.piece, t.gx, t.gy)) {
        this.highlightCompletions(this.drag.piece, t.gx, t.gy);
        for (const [ox, oy] of this.drag.piece.cells) {
          const px = this.bx + (t.gx + ox) * this.cs;
          const py = this.by + (t.gy + oy) * this.cs;
          this.drawBlock(px, py, this.cs, this.drag.piece.color, 0.45);
        }
      }
    }
  }

  private highlightCompletions(piece: Piece, gx: number, gy: number): void {
    const temp = new Set<number>();
    for (const [ox, oy] of piece.cells) temp.add((gy + oy) * GRID + (gx + ox));
    const filled = (x: number, y: number) =>
      this.board[y * GRID + x] !== 0 || temp.has(y * GRID + x);
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(0,240,255,0.12)";
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
    const [light, dark] = PALETTE[color] ?? ["#fff", "#aaa"];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = size * 0.35;
    ctx.shadowColor = light;
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

  private traySlotCenter(i: number): { x: number; y: number } {
    const slotW = this.w / 3;
    return { x: slotW * i + slotW / 2, y: this.trayTop + this.trayH / 2 };
  }

  private drawTray(): void {
    for (let i = 0; i < this.tray.length; i++) {
      const piece = this.tray[i];
      if (!piece || (this.drag && this.drag.slot === i)) continue;
      const c = this.traySlotCenter(i);
      const pw = piece.w * this.trayCS;
      const ph = piece.h * this.trayCS;
      const left = c.x - pw / 2;
      const top = c.y - ph / 2;
      const bob = Math.sin(this.pulse * 2 + i) * this.trayCS * 0.06;
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
    const pw = d.piece.w * this.cs;
    const ph = d.piece.h * this.cs;
    const lift = this.cs * 1.2;
    const left = d.px - pw / 2;
    const top = d.py - ph - lift;
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
    ctx.strokeStyle = "#ff5d6c";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#ff5d6c";
    const r = this.cs * (0.5 + (1 - a) * 0.4);
    ctx.beginPath();
    ctx.arc(this.invalidFx.x, this.invalidFx.y, r, 0, Math.PI * 2);
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
    ctx.fillText(`최고  ${this.best}`, this.w / 2, this.h * 0.028);

    const pop = this.placeAnim > 0 ? 1 + this.placeAnim * 0.06 : 1;
    ctx.fillStyle = "#fff";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#00f0ff";
    const fs = Math.round(this.h * 0.058 * pop);
    ctx.font = `900 ${fs}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(String(this.shownScore), this.w / 2, this.h * 0.052);

    // Level + multiplier line.
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(54,241,205,0.9)";
    ctx.font = `800 ${Math.round(this.h * 0.02)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(`LV ${this.level}  ·  x${this.levelMultiplier().toFixed(1)}`, this.w / 2, this.h * 0.108);

    if (this.streak >= 2 && this.state === "playing") {
      ctx.shadowColor = "#ff2bd6";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ff2bd6";
      ctx.font = `800 ${Math.round(this.h * 0.022)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(`🔥 STREAK x${this.streak}`, this.w / 2, this.h * 0.128);
    }
    ctx.restore();
  }

  private drawButtons(): void {
    // Mute button.
    this.drawButtonBase(this.btnMute);
    this.drawSpeakerIcon(this.btnMute, audio.isMuted());
    // Restart button.
    this.drawButtonBase(this.btnRestart);
    this.drawRestartIcon(this.btnRestart);
  }

  private drawButtonBase(b: Button): void {
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

  private drawSpeakerIcon(b: Button, muted: boolean): void {
    const ctx = this.ctx;
    const s = b.r * 0.5;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = muted ? "rgba(255,93,108,0.95)" : "#fff";
    ctx.strokeStyle = muted ? "rgba(255,93,108,0.95)" : "#fff";
    ctx.lineWidth = b.r * 0.12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // speaker body
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
      ctx.beginPath();
      ctx.arc(s * 0.25, 0, s * 0.95, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawRestartIcon(b: Button): void {
    const ctx = this.ctx;
    const r = b.r * 0.5;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = b.r * 0.13;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.35, Math.PI * 2);
    ctx.stroke();
    // arrowhead
    const ax = Math.cos(Math.PI * 0.35) * r;
    const ay = Math.sin(Math.PI * 0.35) * r;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - r * 0.5, ay - r * 0.1);
    ctx.lineTo(ax + r * 0.05, ay + r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawTutorial(): void {
    const ctx = this.ctx;
    const blink = 0.55 + Math.sin(this.pulse * 3) * 0.45;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00f0ff";
    ctx.font = `700 ${Math.round(this.h * 0.024)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("블록을 드래그해서 줄을 채우세요", this.w / 2, this.trayTop - this.h * 0.02);
    ctx.restore();
  }

  private drawGameOver(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(5,6,15,0.74)";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const u = this.h * 0.04;
    ctx.fillStyle = "#ff5d6c";
    ctx.shadowBlur = 24;
    ctx.shadowColor = "#ff5d6c";
    ctx.font = `900 ${Math.round(u * 1.5)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("GAME OVER", this.w / 2, this.h * 0.3);

    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${Math.round(u * 2)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(String(Math.floor(this.score)), this.w / 2, this.h * 0.4);

    ctx.shadowBlur = 0;
    ctx.font = `700 ${Math.round(u)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = this.newRecord ? "#ff2bd6" : "rgba(255,255,255,0.6)";
    ctx.fillText(this.newRecord ? "★ 신기록!" : `최고  ${this.best}`, this.w / 2, this.h * 0.465);

    // Run stats row.
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `700 ${Math.round(u * 0.7)}px ui-sans-serif, system-ui, sans-serif`;
    const stats = `레벨 ${this.level}    줄 ${this.linesTotal}    최대콤보 x${this.maxCombo}`;
    ctx.fillText(stats, this.w / 2, this.h * 0.52);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `600 ${Math.round(u * 0.62)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(`최고 콤보 기록  x${this.bestCombo}`, this.w / 2, this.h * 0.56);

    if (this.deadTimer > 0.45) {
      const blink = 0.5 + Math.sin(this.pulse * 3) * 0.5;
      ctx.globalAlpha = 0.5 + blink * 0.5;
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${Math.round(u * 1.1)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText("탭하여 다시 시작", this.w / 2, this.h * 0.64);
    }
    ctx.restore();
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

function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function parseHex(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
