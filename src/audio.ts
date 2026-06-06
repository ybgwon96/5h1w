// Procedural sound effects via the Web Audio API — no asset files needed.
// All synthesis is lazy and gated behind the first user gesture so it
// satisfies mobile autoplay policies.
import { getMuted, setMuted } from "./storage";

type Wave = OscillatorType;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = getMuted();

  /** Must be called from within a user-gesture handler. */
  resume(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    setMuted(this.muted);
    return this.muted;
  }

  private tone(
    freq: number,
    duration: number,
    type: Wave = "sine",
    gain = 0.3,
    slideTo?: number
  ): void {
    if (this.muted || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  flip(): void {
    this.tone(420, 0.12, "triangle", 0.22, 680);
  }

  collect(combo: number): void {
    // Rising pitch with combo for a satisfying streak.
    const base = 660 + Math.min(combo, 12) * 40;
    this.tone(base, 0.1, "square", 0.18, base * 1.5);
  }

  death(): void {
    this.tone(220, 0.5, "sawtooth", 0.3, 60);
  }

  start(): void {
    this.tone(523, 0.12, "triangle", 0.25, 784);
  }
}

export const audio = new AudioEngine();
