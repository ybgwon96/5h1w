// Lightweight particle pool for trails, collect bursts and the death blast.
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export class Particles {
  private items: Particle[] = [];

  get count(): number {
    return this.items.length;
  }

  emit(p: Omit<Particle, "maxLife"> & { maxLife?: number }): void {
    this.items.push({ ...p, maxLife: p.maxLife ?? p.life });
  }

  burst(
    x: number,
    y: number,
    count: number,
    color: string,
    opts: { speed?: number; size?: number; gravity?: number; life?: number } = {}
  ): void {
    const { speed = 220, size = 4, gravity = 0, life = 0.6 } = opts;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.emit({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.4),
        size: size * (0.6 + Math.random() * 0.8),
        color,
        gravity,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.items) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  clear(): void {
    this.items.length = 0;
  }
}
