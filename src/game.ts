import { audio } from "./audio";
import { Particles } from "./particles";
import { getBest, setBest } from "./storage";

type State = "menu" | "playing" | "dead";

interface Player {
  x: number;
  y: number;
  vy: number;
  size: number;
  trailTimer: number;
  gravityDir: 1 | -1; // +1 pulls to the floor, -1 to the ceiling
}

interface Obstacle {
  x: number;
  w: number;
  h: number;
  side: "floor" | "ceil";
  scored: boolean;
}

interface Orb {
  x: number;
  y: number;
  r: number;
  collected: boolean;
  pulse: number;
}

const COLORS = {
  cyan: "#00f0ff",
  pink: "#ff2bd6",
  bg: "#05060f",
  white: "#ffffff",
  warn: "#ff5d6c",
};

export class Game {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;

  private state: State = "menu";
  private best = getBest();
  private score = 0;
  private combo = 0;
  private bestCombo = 0;

  private player: Player;
  private obstacles: Obstacle[] = [];
  private orbs: Orb[] = [];
  private particles = new Particles();

  private speed = 0;
  private distance = 0;
  private spawnX = 0;
  private elapsed = 0;
  private shake = 0;
  private flash = 0;
  private gridOffset = 0;
  private deathTimer = 0;
  private pulse = 0;

  // Layout (recomputed on resize).
  private top = 0;
  private bottom = 0;
  private playerX = 0;
  private unit = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.player = { x: 0, y: 0, vy: 0, size: 0, trailTimer: 0, gravityDir: 1 };
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.unit = Math.max(10, Math.min(w, h * 0.6) / 26);
    this.top = h * 0.12;
    this.bottom = h * 0.92;
    this.playerX = w * 0.26;
    this.player.size = this.unit * 1.4;
    this.player.x = this.playerX;
    if (this.state !== "playing") {
      this.player.y = this.bottom - this.player.size / 2;
    }
  }

  /** A tap/click/space. Starts, flips gravity, or restarts. */
  tap(): void {
    audio.resume();
    if (this.state === "menu") {
      this.start();
      return;
    }
    if (this.state === "dead") {
      // Small guard so the death tap doesn't instantly restart.
      if (this.deathTimer > 0.5) this.start();
      return;
    }
    // Flip gravity and give a snappy nudge toward the new surface.
    this.player.gravityDir = this.player.gravityDir === 1 ? -1 : 1;
    this.player.vy = this.flipImpulse() * this.player.gravityDir;
    audio.flip();
    vibrate(12);
    this.particles.burst(this.player.x, this.player.y, 8, COLORS.cyan, {
      speed: 140,
      size: 3,
      life: 0.35,
    });
  }

  private flipImpulse(): number {
    return this.h * 0.62;
  }

  private start(): void {
    this.state = "playing";
    this.score = 0;
    this.combo = 0;
    this.distance = 0;
    this.elapsed = 0;
    this.speed = this.w * 0.42;
    this.obstacles = [];
    this.orbs = [];
    this.particles.clear();
    this.spawnX = this.w + 100;
    this.shake = 0;
    this.flash = 0.4;
    this.player.y = this.bottom - this.player.size / 2;
    this.player.vy = 0;
    this.player.gravityDir = 1;
    this.player.trailTimer = 0;
    audio.start();
    vibrate(20);
  }

  private die(): void {
    this.state = "dead";
    this.deathTimer = 0;
    this.shake = 22;
    this.flash = 0.7;
    this.particles.burst(this.player.x, this.player.y, 46, COLORS.pink, {
      speed: 420,
      size: 5,
      life: 0.9,
      gravity: 600,
    });
    this.particles.burst(this.player.x, this.player.y, 24, COLORS.cyan, {
      speed: 300,
      size: 4,
      life: 0.7,
    });
    audio.death();
    vibrate([40, 30, 60]);
    if (this.score > this.best) {
      this.best = Math.floor(this.score);
      setBest(this.best);
    }
    this.bestCombo = Math.max(this.bestCombo, this.combo);
  }

  update(dt: number): void {
    this.pulse += dt;
    this.particles.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.6);

    if (this.state === "playing") {
      this.elapsed += dt;
      // Ramp difficulty: speed creeps up over time.
      this.speed += dt * this.w * 0.012;
      const dx = this.speed * dt;
      this.distance += dx;
      this.gridOffset = (this.gridOffset + dx) % (this.unit * 4);
      this.score = this.distance / (this.w * 0.06);

      this.updatePlayer(dt);
      this.updateField(dx);
      this.checkCollisions();
    } else {
      // Idle bob on menus.
      this.gridOffset = (this.gridOffset + dt * this.w * 0.05) % (this.unit * 4);
      if (this.state === "dead") this.deathTimer += dt;
    }
  }

  private updatePlayer(dt: number): void {
    // Gravity always pulls toward the player's current gravity direction,
    // which only changes on tap. Landing zeroes velocity but the constant
    // pull keeps the player pinned to that surface until the next flip.
    this.player.vy += this.h * 2.4 * this.player.gravityDir * dt;
    this.player.y += this.player.vy * dt;

    const floorY = this.bottom - this.player.size / 2;
    const ceilY = this.top + this.player.size / 2;
    if (this.player.y >= floorY) {
      this.player.y = floorY;
      if (this.player.vy > this.h * 0.4) this.landFx(floorY + this.player.size / 2);
      this.player.vy = 0;
    } else if (this.player.y <= ceilY) {
      this.player.y = ceilY;
      if (this.player.vy < -this.h * 0.4) this.landFx(ceilY - this.player.size / 2);
      this.player.vy = 0;
    }

    // Trail.
    this.player.trailTimer -= dt;
    if (this.player.trailTimer <= 0) {
      this.player.trailTimer = 0.02;
      this.particles.emit({
        x: this.player.x - this.player.size * 0.3,
        y: this.player.y,
        vx: -this.speed * 0.2,
        vy: (Math.random() - 0.5) * 30,
        life: 0.4,
        size: this.player.size * 0.32,
        color: this.combo >= 5 ? COLORS.pink : COLORS.cyan,
        gravity: 0,
      });
    }
  }

  private landFx(y: number): void {
    this.particles.burst(this.player.x, y, 6, COLORS.cyan, { speed: 90, size: 2.5, life: 0.3 });
  }

  private updateField(dx: number): void {
    for (const o of this.obstacles) o.x -= dx;
    for (const orb of this.orbs) {
      orb.x -= dx;
      orb.pulse += dx * 0.01;
    }
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -50);
    this.orbs = this.orbs.filter((o) => o.x > -50 && !o.collected);

    // Spawn ahead as the world scrolls.
    this.spawnX -= dx;
    while (this.spawnX < this.w + 80) {
      this.spawnPattern();
    }
  }

  private spawnPattern(): void {
    const gap = this.bottom - this.top;
    // Difficulty: gaps between obstacles shrink as speed rises.
    const minGap = Math.max(this.w * 0.34, this.player.size * 5);
    const stride = Math.max(minGap, this.w * 0.6 - this.elapsed * 2);

    const side: "floor" | "ceil" = Math.random() < 0.5 ? "floor" : "ceil";
    const h = gap * (0.46 + Math.random() * 0.16);
    const w = this.unit * (1.4 + Math.random() * 1.2);
    this.obstacles.push({ x: this.spawnX, w, h, side, scored: false });

    // Reward orb in the safe channel (opposite the obstacle).
    if (Math.random() < 0.7) {
      const orbY =
        side === "floor"
          ? this.top + gap * (0.18 + Math.random() * 0.12)
          : this.bottom - gap * (0.18 + Math.random() * 0.12);
      this.orbs.push({
        x: this.spawnX + w * 0.5,
        y: orbY,
        r: this.unit * 0.55,
        collected: false,
        pulse: Math.random() * Math.PI * 2,
      });
    }
    this.spawnX += stride;
  }

  private checkCollisions(): void {
    const p = this.player;
    const half = p.size / 2;
    const pl = p.x - half;
    const pr = p.x + half;
    const pt = p.y - half;
    const pb = p.y + half;

    for (const o of this.obstacles) {
      const oy = o.side === "floor" ? this.bottom - o.h : this.top;
      const ob = o.side === "floor" ? this.bottom : this.top + o.h;
      if (pr > o.x && pl < o.x + o.w && pb > oy && pt < ob) {
        this.die();
        return;
      }
      if (!o.scored && o.x + o.w < pl) {
        o.scored = true;
        this.score += 5;
      }
    }

    for (const orb of this.orbs) {
      if (orb.collected) continue;
      const dx = orb.x - p.x;
      const dy = orb.y - p.y;
      if (dx * dx + dy * dy < (orb.r + half) * (orb.r + half)) {
        orb.collected = true;
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.score += 10 + this.combo * 2;
        audio.collect(this.combo);
        vibrate(8);
        this.particles.burst(orb.x, orb.y, 14, COLORS.pink, {
          speed: 200,
          size: 3,
          life: 0.5,
        });
        this.flash = Math.min(0.3, this.flash + 0.12);
      }
    }
  }

  // ---- Rendering ---------------------------------------------------------

  render(): void {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this.drawBackground();
    this.drawBounds();

    for (const o of this.obstacles) this.drawObstacle(o);
    for (const orb of this.orbs) this.drawOrb(orb);

    this.particles.draw(ctx);

    if (this.state !== "dead") this.drawPlayer();

    ctx.restore();

    this.drawHud();
    if (this.state === "menu") this.drawMenu();
    if (this.state === "dead") this.drawGameOver();

    if (this.flash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.5})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, "#0a0b1e");
    grad.addColorStop(1, COLORS.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    // Parallax neon grid.
    ctx.save();
    ctx.strokeStyle = "rgba(0,240,255,0.08)";
    ctx.lineWidth = 1;
    const step = this.unit * 4;
    for (let x = -this.gridOffset; x < this.w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, this.top);
      ctx.lineTo(x, this.bottom);
      ctx.stroke();
    }
    for (let y = this.top; y <= this.bottom; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBounds(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = COLORS.cyan;
    ctx.shadowBlur = 18;
    ctx.shadowColor = COLORS.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, this.top);
    ctx.lineTo(this.w, this.top);
    ctx.moveTo(0, this.bottom);
    ctx.lineTo(this.w, this.bottom);
    ctx.stroke();
    ctx.restore();
  }

  private drawObstacle(o: Obstacle): void {
    const ctx = this.ctx;
    const y = o.side === "floor" ? this.bottom - o.h : this.top;
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = COLORS.pink;
    const g = ctx.createLinearGradient(o.x, y, o.x, y + o.h);
    g.addColorStop(0, "#ff2bd6");
    g.addColorStop(1, "#7a1aff");
    ctx.fillStyle = g;
    roundRect(ctx, o.x, y, o.w, o.h, Math.min(8, o.w / 3));
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    roundRect(ctx, o.x + 2, y + (o.side === "floor" ? 2 : o.h - 8), o.w - 4, 6, 3);
    ctx.fill();
    ctx.restore();
  }

  private drawOrb(orb: Orb): void {
    const ctx = this.ctx;
    const r = orb.r * (1 + Math.sin(orb.pulse + this.pulse * 4) * 0.12);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 24;
    ctx.shadowColor = COLORS.cyan;
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlayer(): void {
    const ctx = this.ctx;
    const p = this.player;
    const s = p.size;
    ctx.save();
    ctx.shadowBlur = 26;
    ctx.shadowColor = this.combo >= 5 ? COLORS.pink : COLORS.cyan;
    const g = ctx.createLinearGradient(p.x - s / 2, p.y - s / 2, p.x + s / 2, p.y + s / 2);
    g.addColorStop(0, "#aef9ff");
    g.addColorStop(1, this.combo >= 5 ? COLORS.pink : COLORS.cyan);
    ctx.fillStyle = g;
    roundRect(ctx, p.x - s / 2, p.y - s / 2, s, s, s * 0.28);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    roundRect(ctx, p.x - s * 0.28, p.y - s * 0.28, s * 0.3, s * 0.3, s * 0.1);
    ctx.fill();
    ctx.restore();
  }

  private drawHud(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.white;
    ctx.shadowBlur = 12;
    ctx.shadowColor = COLORS.cyan;
    const big = Math.round(this.unit * 2.2);
    ctx.font = `700 ${big}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(String(Math.floor(this.score)), this.w / 2, this.h * 0.03);

    ctx.font = `600 ${Math.round(this.unit * 0.9)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.shadowBlur = 0;
    ctx.fillText(`BEST ${this.best}`, this.w / 2, this.h * 0.03 + big + 4);

    if (this.state === "playing" && this.combo >= 2) {
      ctx.fillStyle = COLORS.pink;
      ctx.shadowBlur = 10;
      ctx.shadowColor = COLORS.pink;
      ctx.font = `800 ${Math.round(this.unit * 1.3)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(`x${this.combo} COMBO`, this.w / 2, this.h * 0.03 + big + this.unit * 1.6);
    }
    ctx.restore();
  }

  private drawMenu(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const title = "NEON DASH";
    const ts = Math.round(this.unit * 3.4);
    ctx.font = `900 ${ts}px ui-sans-serif, system-ui, sans-serif`;
    ctx.shadowBlur = 30;
    ctx.shadowColor = COLORS.cyan;
    ctx.fillStyle = COLORS.cyan;
    ctx.fillText(title, this.w / 2, this.h * 0.4);
    ctx.fillStyle = COLORS.pink;
    ctx.shadowColor = COLORS.pink;
    ctx.globalAlpha = 0.35;
    ctx.fillText(title, this.w / 2 + 3, this.h * 0.4 + 3);
    ctx.globalAlpha = 1;

    const blink = 0.5 + Math.sin(this.pulse * 3) * 0.5;
    ctx.globalAlpha = 0.5 + blink * 0.5;
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.white;
    ctx.font = `600 ${Math.round(this.unit * 1.3)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("탭하여 시작", this.w / 2, this.h * 0.55);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `500 ${Math.round(this.unit)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("탭 = 중력 반전 · 오브를 모아 콤보", this.w / 2, this.h * 0.62);
    ctx.restore();
  }

  private drawGameOver(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(5,6,15,0.55)";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = `900 ${Math.round(this.unit * 2.6)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.shadowBlur = 24;
    ctx.shadowColor = COLORS.warn;
    ctx.fillStyle = COLORS.warn;
    ctx.fillText("GAME OVER", this.w / 2, this.h * 0.34);

    ctx.shadowBlur = 12;
    ctx.shadowColor = COLORS.cyan;
    ctx.fillStyle = COLORS.white;
    ctx.font = `800 ${Math.round(this.unit * 2)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(`${Math.floor(this.score)}`, this.w / 2, this.h * 0.46);

    ctx.shadowBlur = 0;
    ctx.font = `600 ${Math.round(this.unit)}px ui-sans-serif, system-ui, sans-serif`;
    const isNew = Math.floor(this.score) >= this.best && this.best > 0;
    ctx.fillStyle = isNew ? COLORS.pink : "rgba(255,255,255,0.6)";
    ctx.fillText(isNew ? "★ 신기록!" : `BEST ${this.best}`, this.w / 2, this.h * 0.52);

    if (this.deathTimer > 0.5) {
      const blink = 0.5 + Math.sin(this.pulse * 3) * 0.5;
      ctx.globalAlpha = 0.5 + blink * 0.5;
      ctx.fillStyle = COLORS.white;
      ctx.font = `600 ${Math.round(this.unit * 1.2)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText("탭하여 다시 시작", this.w / 2, this.h * 0.62);
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

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
